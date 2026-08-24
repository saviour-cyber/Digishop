import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as productController from '../controllers/productController';

const router = Router();

router.use(authenticate);

router.get('/categories', productController.listCategories);
router.post('/categories', productController.createCategory);

router.get('/products', productController.listProducts);
router.post('/products', productController.createProduct);
router.get('/products/barcode/:barcode', productController.lookupBarcode);
router.get('/products/:id', productController.getProduct);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);
router.post('/products/:id/stock', productController.addStock);

export default router;
