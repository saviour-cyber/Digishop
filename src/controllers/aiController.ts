import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { getShopByOwner } from '../services/shopService';
import { getProducts } from '../services/productService';
import prisma from '../config/database';

const ai = new GoogleGenAI({}); // Automatically uses process.env.GEMINI_API_KEY

const chatSchema = z.object({
  message: z.string().min(1).max(1000),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    parts: z.array(z.object({ text: z.string() }))
  })).optional().default([]),
});

export const handleChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shop = await getShopByOwner(req.user!.userId);
    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found. Please create a shop first.' });
      return;
    }

    const validation = chatSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, message: validation.error.issues[0].message });
      return;
    }

    const { message, history } = validation.data;

    // 1. Gather Shop Context
    const products = await getProducts(shop.id, { limit: 1000 }); // Get all products for context
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.buyingPrice * p.stockQuantity), 0);
    const lowStockItems = products.filter(p => p.stockQuantity <= p.lowStockThreshold);

    const systemInstruction = `You are a helpful, professional AI shop assistant for a Kenyan small business named "${shop.name}".
    Here is the shop's current data context:
    - Total products in inventory: ${products.length}
    - Total inventory value (buying price): KES ${(totalInventoryValue / 100).toFixed(2)}
    - Items currently low on stock: ${lowStockItems.length}
      ${lowStockItems.length > 0 ? `(${lowStockItems.map(p => `${p.name} - Qty: ${p.stockQuantity}`).join(', ')})` : ''}

    Rules:
    - Be concise, practical, and helpful.
    - If asked about inventory, use the data provided above.
    - Do not invent products or data. If you don't know, say you don't know based on current data.
    - Currency is Kenyan Shillings (KES). Note that prices in database might be in cents, but display them appropriately (e.g. KES 150.00). Actually, I've divided by 100 for you in the total value, but be aware.
    - Keep responses short, suited for a mobile chat interface.
    `;

    // 2. Call Gemini
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            ...history,
            { role: 'user', parts: [{ text: message }] }
        ],
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
        }
    });
    
    const replyText = response.text || "I'm sorry, I couldn't process that request.";

    res.json({
      success: true,
      data: {
        reply: replyText
      }
    });

  } catch (error: any) {
    console.error("AI Error:", error);
    // Handle case where API key is missing
    if (error.message && error.message.includes('API key')) {
         res.status(500).json({ success: false, message: 'AI Assistant is currently unavailable. Please check configuration.' });
         return;
    }
    next(error);
  }
};
