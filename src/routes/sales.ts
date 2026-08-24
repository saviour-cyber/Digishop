import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { recordSale, listSales, getSummary } from '../controllers/saleController';

const router = Router();

router.use(authenticate);

router.post('/', recordSale);
router.get('/', listSales);
router.get('/summary', getSummary);

export default router;

