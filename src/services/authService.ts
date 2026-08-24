import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { AuthPayload } from '../types';

/**
 * Generates a cryptographically secure 6-digit OTP.
 */
export const generateOtp = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Generates a JWT token for a user.
 */
export const generateJwt = (userId: string, shopId?: string): string => {
  const secret = process.env.JWT_SECRET!;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const payload: AuthPayload = { userId, ...(shopId && { shopId }) };
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
};

/**
 * Stub for SMS sending. In production, integrate with Africa's Talking or Twilio.
 * REPLACE THIS with a real SMS provider before going live.
 */
const sendSmsOtp = async (phone: string, otp: string): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    // TODO: Replace with Africa's Talking or Twilio integration
    // Example (Africa's Talking):
    // const AfricasTalking = require('africastalking');
    // const at = AfricasTalking({ apiKey: process.env.AT_API_KEY, username: process.env.AT_USERNAME });
    // await at.SMS.send({ to: [phone], message: `Your AI Shop Assistant OTP is: ${otp}. Valid for 10 minutes.` });
    console.warn('[SMS] Production SMS not configured. OTP not sent to:', phone);
  } else {
    console.log(`[DEV] OTP for ${phone}: ${otp}`);
  }
};

/**
 * Finds or creates a user by phone number.
 */
export const createOrFindUser = async (
  phone: string,
  name: string
): Promise<{ id: string; phone: string; name: string }> => {
  const user = await prisma.user.upsert({
    where: { phone },
    update: { name },
    create: { phone, name },
    select: { id: true, phone: true, name: true },
  });
  return user;
};

/**
 * Creates an OTP code record in the database (10-minute expiry).
 */
export const createOtpCode = async (userId: string): Promise<string> => {
  // Invalidate any existing OTPs for this user
  await prisma.otpCode.updateMany({
    where: { userId, isUsed: false },
    data: { isUsed: true },
  });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.otpCode.create({
    data: { userId, code, expiresAt },
  });

  return code;
};

/**
 * Verifies an OTP code. Returns the user if valid.
 */
export const verifyOtpCode = async (
  phone: string,
  code: string
): Promise<{ id: string; name: string; phone: string; isVerified: boolean } | null> => {
  const user = await prisma.user.findUnique({
    where: { phone },
    include: {
      otpCodes: {
        where: {
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!user || user.otpCodes.length === 0) return null;

  const otpRecord = user.otpCodes[0];
  if (otpRecord.code !== code) return null;

  // Mark OTP as used and mark user as verified
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { isUsed: true },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true },
  });

  return { id: user.id, name: user.name, phone: user.phone, isVerified: true };
};

/**
 * Handles full OTP request flow: create/find user, generate OTP, optionally send SMS.
 * Returns the OTP in dev mode only.
 */
export const requestOtpFlow = async (
  phone: string,
  name: string
): Promise<{ devOtp?: string }> => {
  const user = await createOrFindUser(phone, name);
  const otp = await createOtpCode(user.id);
  await sendSmsOtp(phone, otp);

  // Always return the dev OTP for now until SMS is integrated
  return { devOtp: otp };
};
