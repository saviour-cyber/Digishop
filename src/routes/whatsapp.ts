import { Router } from 'express';
import { handleWhatsAppWebhook } from '../controllers/whatsappController';

const router = Router();

// Twilio webhooks are POST requests
router.post('/webhook', handleWhatsAppWebhook);

export default router;
