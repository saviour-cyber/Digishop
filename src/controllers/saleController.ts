import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createSale, getSales, getSalesSummary } from '../services/saleService';

const createSaleSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1, 'At least one item is required.'),
  note: z.string().optional(),
});

export const recordSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shopId = (req as any).user.shopId;
    if (!shopId) { res.status(403).json({ success: false, message: 'No shop linked to this account.' }); return; }

    const parsed = createSaleSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0].message }); return; }

    const sale = await createSale(shopId, parsed.data.items, parsed.data.note);
    res.status(201).json({ success: true, message: 'Sale recorded.', data: sale });
  } catch (error: any) {
    if (error.message?.includes('Insufficient stock') || error.message?.includes('not found')) {
      res.status(400).json({ success: false, message: error.message });
    } else {
      next(error);
    }
  }
};

export const listSales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shopId = (req as any).user.shopId;
    if (!shopId) { res.status(403).json({ success: false, message: 'No shop linked.' }); return; }
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const sales = await getSales(shopId, limit, offset);
    res.json({ success: true, data: sales });
  } catch (error) { next(error); }
};

export const getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shopId = (req as any).user.shopId;
    if (!shopId) { res.status(403).json({ success: false, message: 'No shop linked.' }); return; }
    const summary = await getSalesSummary(shopId);
    res.json({ success: true, data: summary });
  } catch (error) { next(error); }
};

