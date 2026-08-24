import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { handleChat } from '../controllers/aiController';

const router = Router();

router.use(authenticate);

router.post('/chat', handleChat);

export default router;
