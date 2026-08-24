import { Router } from 'express';
import {
  createNewShop,
  getMyShop,
  updateMyShop,
  reqWhatsAppVerification,
  confirmWhatsApp,
  unlinkWhatsAppAccount
} from '../controllers/shopController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All shop routes require authentication
router.use(authenticate);

router.post('/', createNewShop);
router.get('/me', getMyShop);
router.put('/me', updateMyShop);

router.post('/me/whatsapp/request-verification', reqWhatsAppVerification);
router.post('/me/whatsapp/confirm-verification', confirmWhatsApp);
router.delete('/me/whatsapp', unlinkWhatsAppAccount);

export default router;
