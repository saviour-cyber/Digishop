import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as productService from '../services/productService';
import { getShopByOwner } from '../services/shopService';
import { createError } from '../middleware/errorHandler';

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  buyingPrice: z.number().int().min(0),
  sellingPrice: z.number().int().min(0),
  stockQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
});

const updateProductSchema = createProductSchema.partial();

const stockMovementSchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.number().int().min(1),
  note: z.string().optional(),
});

async function requireShop(req: Request, res: Response) {
  const shop = await getShopByOwner(req.user!.userId);
  if (!shop) {
    res.status(404).json({ success: false, message: 'Shop not found. Please create a shop first.' });
    return null;
  }
  return shop;
}

export const listProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shop = await requireShop(req, res);
    if (!shop) return;
    const { search, categoryId, lowStock } = req.query;
    const products = await productService.getProducts(shop.id, {
      search: search as string,
      categoryId: categoryId as string,
      lowStock: lowStock === 'true',
    });
    res.json({ success: true, data: products });
  } catch (e) { next(e); }
};

export const getProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shop = await requireShop(req, res);
    if (!shop) return;
    const product = await productService.getProductById(shop.id, (req.params.id as string));
    if (!product) { res.status(404).json({ success: false, message: 'Product not found.' }); return; }
    res.json({ success: true, data: product });
  } catch (e) { next(e); }
};

export const lookupBarcode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shop = await requireShop(req, res);
    if (!shop) return;
    const product = await productService.getProductByBarcode(shop.id, (req.params.barcode as string));
    if (!product) { res.status(404).json({ success: false, message: 'No product found with this barcode.' }); return; }
    res.json({ success: true, data: product });
  } catch (e) { next(e); }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shop = await requireShop(req, res);
    if (!shop) return;
    const validation = createProductSchema.safeParse(req.body);
    if (!validation.success) { res.status(400).json({ success: false, message: validation.error.issues[0].message }); return; }
    const product = await productService.createProduct(shop.id, validation.data);
    res.status(201).json({ success: true, message: 'Product created.', data: product });
  } catch (e) { next(e); }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shop = await requireShop(req, res);
    if (!shop) return;
    const validation = updateProductSchema.safeParse(req.body);
    if (!validation.success) { res.status(400).json({ success: false, message: validation.error.issues[0].message }); return; }
    const existing = await productService.getProductById(shop.id, (req.params.id as string));
    if (!existing) { res.status(404).json({ success: false, message: 'Product not found.' }); return; }
    const product = await productService.updateProduct(shop.id, (req.params.id as string), validation.data);
    res.json({ success: true, message: 'Product updated.', data: product });
  } catch (e) { next(e); }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shop = await requireShop(req, res);
    if (!shop) return;
    const existing = await productService.getProductById(shop.id, (req.params.id as string));
    if (!existing) { res.status(404).json({ success: false, message: 'Product not found.' }); return; }
    await productService.deleteProduct(shop.id, (req.params.id as string));
    res.json({ success: true, message: 'Product deleted.' });
  } catch (e) { next(e); }
};

export const addStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shop = await requireShop(req, res);
    if (!shop) return;
    const validation = stockMovementSchema.safeParse(req.body);
    if (!validation.success) { res.status(400).json({ success: false, message: validation.error.issues[0].message }); return; }
    const existing = await productService.getProductById(shop.id, (req.params.id as string));
    if (!existing) { res.status(404).json({ success: false, message: 'Product not found.' }); return; }
    const result = await productService.addStockMovement(shop.id, (req.params.id as string), validation.data.type, validation.data.quantity, validation.data.note);
    res.json({ success: true, message: 'Stock updated.', data: result });
  } catch (e) { next(e); }
};

export const listCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shop = await requireShop(req, res);
    if (!shop) return;
    const categories = await productService.getCategories(shop.id);
    res.json({ success: true, data: categories });
  } catch (e) { next(e); }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shop = await requireShop(req, res);
    if (!shop) return;
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      res.status(400).json({ success: false, message: 'Category name is required.' }); return;
    }
    const category = await productService.createCategory(shop.id, name.trim());
    res.status(201).json({ success: true, message: 'Category created.', data: category });
  } catch (e) { next(e); }
};
