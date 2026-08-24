import { Router } from 'express';
import { requestOtp, verifyOtp, getMe, getBusinessTypes } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.get('/business-types', getBusinessTypes);
router.get('/me', authenticate, getMe);

export default router;
