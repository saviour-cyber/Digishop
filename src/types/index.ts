export interface AuthPayload {
  userId: string;
  shopId?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export type AuditSource = 'APP' | 'WHATSAPP' | 'AI' | 'SYSTEM';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
