import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createShop,
  getShopByOwner,
  updateShop,
  requestWhatsAppVerification,
  confirmWhatsAppVerification,
  unlinkWhatsApp,
} from '../services/shopService';

const createShopSchema = z.object({
  name: z.string().min(2, 'Shop name must be at least 2 characters').max(100),
  location: z.string().max(255).optional(),
  description: z.string().max(500).optional(),
  businessTypeId: z.number().int().positive().optional(),
});

const whatsappRequestSchema = z.object({
  phoneNumber: z.string().regex(/^\+254[0-9]{9}$/, 'Enter a valid Kenyan number e.g. +254712345678'),
});

const whatsappConfirmSchema = z.object({
  phoneNumber: z.string().regex(/^\+254[0-9]{9}$/, 'Enter a valid Kenyan number'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

export const createNewShop = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const existingShop = await getShopByOwner(userId);

    if (existingShop) {
      res.status(409).json({ success: false, message: 'You already own a shop.' });
      return;
    }

    const validation = createShopSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, message: validation.error.issues[0].message });
      return;
    }

    const { name, location, description, businessTypeId } = validation.data;
    const shop = await createShop(userId, name, location, description, businessTypeId);

    res.status(201).json({
      success: true,
      message: 'Shop created successfully.',
      data: { shop },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyShop = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const shop = await getShopByOwner(userId);

    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found.' });
      return;
    }

    res.status(200).json({ success: true, data: { shop } });
  } catch (error) {
    next(error);
  }
};

export const updateMyShop = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const shop = await getShopByOwner(userId);

    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found.' });
      return;
    }

    const validation = createShopSchema.partial().safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, message: validation.error.issues[0].message });
      return;
    }

    const updated = await updateShop(shop.id, validation.data);
    res.status(200).json({ success: true, message: 'Shop updated.', data: { shop: updated } });
  } catch (error) {
    next(error);
  }
};

export const reqWhatsAppVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const shop = await getShopByOwner(userId);

    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found.' });
      return;
    }

    const validation = whatsappRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, message: validation.error.issues[0].message });
      return;
    }

    const { phoneNumber } = validation.data;
    const result = await requestWhatsAppVerification(shop.id, phoneNumber);

    if (result.error) {
      res.status(409).json({ success: false, message: result.error });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'WhatsApp verification initiated.',
      ...(result.devCode && { devCode: result.devCode }),
    });
  } catch (error) {
    next(error);
  }
};

export const confirmWhatsApp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const shop = await getShopByOwner(userId);

    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found.' });
      return;
    }

    const validation = whatsappConfirmSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, message: validation.error.issues[0].message });
      return;
    }

    const { phoneNumber, code } = validation.data;
    const result = await confirmWhatsAppVerification(shop.id, phoneNumber, code);

    if (!result.success) {
      res.status(400).json({ success: false, message: result.error });
      return;
    }

    res.status(200).json({ success: true, message: 'WhatsApp linked successfully.' });
  } catch (error) {
    next(error);
  }
};

export const unlinkWhatsAppAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const shop = await getShopByOwner(userId);

    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found.' });
      return;
    }

    await unlinkWhatsApp(shop.id);
    res.status(200).json({ success: true, message: 'WhatsApp unlinked successfully.' });
  } catch (error) {
    next(error);
  }
};
