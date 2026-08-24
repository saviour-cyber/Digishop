import { Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import { GoogleGenAI } from '@google/genai';
import prisma from '../config/database';

const ai = new GoogleGenAI({}); 

export const handleWhatsAppWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const twiml = new twilio.twiml.MessagingResponse();
  try {
    // Twilio sends the sender's phone number in the 'From' field (e.g. 'whatsapp:+254712345678')
    const from = req.body.From;
    const body = req.body.Body;

    if (!from || !body) {
      res.status(400).send('Missing From or Body');
      return;
    }

    // Extract raw phone number
    const phoneNumber = from.replace('whatsapp:', '');

    // 1. Find User and their Shop
    const user = await prisma.user.findUnique({
      where: { phone: phoneNumber },
      include: { shops: { include: { shop: true } } }
    });

    if (!user || user.shops.length === 0) {
      twiml.message("Hello! It looks like you haven't created a shop yet. Please download the AI Shop Assistant app and register your shop first.");
      res.type('text/xml').send(twiml.toString());
      return;
    }

    const shop = user.shops[0].shop;

    // 2. Gather Shop Context
    const products = await prisma.product.findMany({
      where: { shopId: shop.id }
    });
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.buyingPrice * p.stockQuantity), 0);
    const lowStockItems = products.filter(p => p.stockQuantity <= p.lowStockThreshold);

    const systemInstruction = `You are a helpful, professional AI shop assistant for a Kenyan small business named "${shop.name}". You are responding to the shop owner via WhatsApp.
    Here is the shop's current data context:
    - Total products in inventory: ${products.length}
    - Total inventory value (buying price): KES ${(totalInventoryValue / 100).toFixed(2)}
    - Items currently low on stock: ${lowStockItems.length}
      ${lowStockItems.length > 0 ? `(${lowStockItems.map(p => `${p.name} - Qty: ${p.stockQuantity}`).join(', ')})` : ''}

    Rules:
    - Be concise, practical, and helpful (it's a WhatsApp message, keep it short).
    - If asked about inventory, use the data provided above.
    - Do not invent products or data.
    - Currency is Kenyan Shillings (KES).
    `;

    // 3. Call Gemini
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'user', parts: [{ text: body }] }
        ],
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
        }
    });
    
    const replyText = response.text || "I'm sorry, I couldn't process that request right now.";

    // 4. Send Twilio XML Response
    twiml.message(replyText);
    res.type('text/xml').send(twiml.toString());

  } catch (error: any) {
    console.error("WhatsApp Webhook Error:", error);
    twiml.message("Sorry, I encountered an error while processing your request. Please try again later.");
    res.type('text/xml').send(twiml.toString());
  }
};
