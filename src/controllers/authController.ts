import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  requestOtpFlow,
  verifyOtpCode,
  generateJwt,
} from '../services/authService';
import { getShopByOwner } from '../services/shopService';
import prisma from '../config/database';
import { createError } from '../middleware/errorHandler';

const requestOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+254[0-9]{9}$/, 'Enter a valid Kenyan number e.g. +254712345678'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

const verifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+254[0-9]{9}$/, 'Enter a valid phone number'),
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export const requestOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validation = requestOtpSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
      return;
    }

    const { phone, name } = validation.data;
    const result = await requestOtpFlow(phone, name);

    res.status(200).json({
      success: true,
      message: 'OTP sent to your phone number.',
      ...(result.devOtp && { devOtp: result.devOtp }),
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validation = verifyOtpSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
      return;
    }

    const { phone, code } = validation.data;
    const user = await verifyOtpCode(phone, code);

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.',
      });
      return;
    }

    const shop = await getShopByOwner(user.id);
    const token = generateJwt(user.id, shop?.id);

    res.status(200).json({
      success: true,
      message: 'Phone number verified successfully.',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          isVerified: user.isVerified,
        },
        hasShop: !!shop,
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, isVerified: true },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const shop = await getShopByOwner(userId);

    res.status(200).json({
      success: true,
      message: 'User retrieved.',
      data: { user, shop },
    });
  } catch (error) {
    next(error);
  }
};

export const getBusinessTypes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const types = await prisma.businessType.findMany({
      orderBy: { id: 'asc' },
    });
    res.status(200).json({ success: true, data: types });
  } catch (error) {
    next(error);
  }
};
