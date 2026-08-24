import crypto from 'crypto';
import prisma from '../config/database';

const BUSINESS_TYPES = [
  'Kiosk',
  'Mini-market',
  'Grocery',
  'Restaurant/Food business',
  'Salon/Barbershop',
  'Hardware',
  'Phone & accessories',
  'Clothing',
  'Pharmacy',
  'Other',
];

/**
 * Seeds business types if the table is empty.
 */
export const seedBusinessTypes = async (): Promise<void> => {
  const count = await prisma.businessType.count();
  if (count === 0) {
    await prisma.businessType.createMany({
      data: BUSINESS_TYPES.map((name) => ({ name })),
    });
    console.log('[SEED] Business types seeded.');
  }
};

import { Prisma } from '@prisma/client';

/**
 * Creates a new shop and assigns the user as OWNER (in a transaction).
 */
export const createShop = async (
  ownerId: string,
  name: string,
  location?: string,
  description?: string,
  businessTypeId?: number
): Promise<{
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  businessTypeId: number | null;
  ownerId: string;
  businessType: { id: number; name: string } | null;
}> => {
  const shop = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const newShop = await tx.shop.create({
      data: {
        name,
        location,
        description,
        ownerId,
        ...(businessTypeId && { businessTypeId }),
      },
      include: { businessType: true },
    });

    await tx.shopMember.create({
      data: {
        shopId: newShop.id,
        userId: ownerId,
        role: 'OWNER',
      },
    });

    return newShop;
  });

  return shop;
};

/**
 * Gets the shop where the user is an OWNER.
 */
export const getShopByOwner = async (
  userId: string
): Promise<{
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  businessTypeId: number | null;
  ownerId: string;
  businessType: { id: number; name: string } | null;
  whatsappAccounts: { id: string; phoneNumber: string; isVerified: boolean }[];
} | null> => {
  const member = await prisma.shopMember.findFirst({
    where: { userId, role: 'OWNER' },
    include: {
      shop: {
        include: {
          businessType: true,
          whatsappAccounts: {
            select: { id: true, phoneNumber: true, isVerified: true },
          },
        },
      },
    },
  });

  return member?.shop ?? null;
};

/**
 * Updates shop fields.
 */
export const updateShop = async (
  shopId: string,
  data: {
    name?: string;
    location?: string | null;
    description?: string | null;
    businessTypeId?: number | null;
  }
): Promise<{ id: string; name: string }> => {
  return prisma.shop.update({
    where: { id: shopId },
    data,
    select: { id: true, name: true },
  });
};

/**
 * Verifies the user is a member of the given shop.
 */
export const getShopMember = async (
  shopId: string,
  userId: string
): Promise<{ id: string; role: string } | null> => {
  return prisma.shopMember.findFirst({
    where: { shopId, userId },
    select: { id: true, role: true },
  });
};

/**
 * Initiates WhatsApp number verification.
 * Returns error if number already linked to another shop.
 */
export const requestWhatsAppVerification = async (
  shopId: string,
  phoneNumber: string
): Promise<{ devCode?: string; error?: string }> => {
  // Check if this number is already linked to another shop
  const existing = await prisma.whatsappAccount.findUnique({
    where: { phoneNumber },
  });

  if (existing && existing.shopId !== shopId && existing.isVerified) {
    return {
      error:
        'This WhatsApp number is already linked to another account. Please use a different number or contact support.',
    };
  }

  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.whatsappAccount.upsert({
    where: { phoneNumber },
    update: {
      shopId,
      verificationCode: code,
      verificationExpiresAt: expiresAt,
      isVerified: false,
      linkedAt: null,
    },
    create: {
      shopId,
      phoneNumber,
      verificationCode: code,
      verificationExpiresAt: expiresAt,
    },
  });

  // In production: send verification message via WhatsApp Business API
  // TODO: Replace with WhatsApp Business API call
  console.log(`[DEV] WhatsApp verification code for ${phoneNumber}: ${code}`);

  if (process.env.NODE_ENV !== 'production') {
    return { devCode: code };
  }
  return {};
};

/**
 * Confirms WhatsApp verification code.
 */
export const confirmWhatsAppVerification = async (
  shopId: string,
  phoneNumber: string,
  code: string
): Promise<{ success: boolean; error?: string }> => {
  const account = await prisma.whatsappAccount.findUnique({
    where: { phoneNumber },
  });

  if (!account || account.shopId !== shopId) {
    return { success: false, error: 'Unable to verify this WhatsApp number.' };
  }

  if (
    account.isVerified ||
    account.verificationCode !== code ||
    !account.verificationExpiresAt ||
    account.verificationExpiresAt < new Date()
  ) {
    return {
      success: false,
      error: 'Invalid or expired verification code. Please try again.',
    };
  }

  await prisma.whatsappAccount.update({
    where: { phoneNumber },
    data: {
      isVerified: true,
      linkedAt: new Date(),
      verificationCode: null,
      verificationExpiresAt: null,
    },
  });

  return { success: true };
};

/**
 * Unlinks WhatsApp from a shop.
 */
export const unlinkWhatsApp = async (shopId: string): Promise<void> => {
  await prisma.whatsappAccount.deleteMany({ where: { shopId } });
};
