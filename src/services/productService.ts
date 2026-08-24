import prisma from '../config/database';

const DEFAULT_CATEGORIES = ['General', 'Food & Drinks', 'Electronics', 'Clothing', 'Other'];

export async function seedCategories(shopId: string): Promise<void> {
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { shopId_name: { shopId, name } },
      update: {},
      create: { shopId, name },
    });
  }
}

export async function getCategories(shopId: string) {
  return prisma.category.findMany({
    where: { shopId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
}

export async function createCategory(shopId: string, name: string) {
  return prisma.category.create({ data: { shopId, name } });
}

export async function getProducts(
  shopId: string,
  opts: { search?: string; categoryId?: string; lowStock?: boolean; page?: number; limit?: number }
) {
  const { search, categoryId, lowStock, page = 1, limit = 50 } = opts;
  const where: any = { shopId, isActive: true };
  if (search) where.name = { contains: search };
  if (categoryId) where.categoryId = categoryId;

  const products = await prisma.product.findMany({
    where,
    include: { category: true },
    orderBy: { name: 'asc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  if (lowStock) {
    return products.filter((p) => p.stockQuantity <= p.lowStockThreshold);
  }
  return products;
}

export async function getProductById(shopId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, shopId, isActive: true },
    include: { category: true, stockMovements: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
}

export async function getProductByBarcode(shopId: string, barcode: string) {
  return prisma.product.findFirst({
    where: { shopId, barcode, isActive: true },
    include: { category: true },
  });
}

export async function createProduct(
  shopId: string,
  data: {
    name: string;
    description?: string;
    barcode?: string;
    categoryId?: string;
    buyingPrice: number;
    sellingPrice: number;
    stockQuantity: number;
    lowStockThreshold: number;
  }
) {
  const product = await prisma.product.create({
    data: { shopId, ...data },
    include: { category: true },
  });
  if (data.stockQuantity > 0) {
    await prisma.stockMovement.create({
      data: { productId: product.id, shopId, type: 'IN', quantity: data.stockQuantity, note: 'Initial stock' },
    });
  }
  return product;
}

export async function updateProduct(
  shopId: string,
  productId: string,
  data: {
    name?: string;
    description?: string;
    barcode?: string;
    categoryId?: string;
    buyingPrice?: number;
    sellingPrice?: number;
    lowStockThreshold?: number;
  }
) {
  return prisma.product.update({ where: { id: productId }, data, include: { category: true } });
}

export async function deleteProduct(shopId: string, productId: string) {
  return prisma.product.update({ where: { id: productId }, data: { isActive: false } });
}

export async function addStockMovement(
  shopId: string,
  productId: string,
  type: 'IN' | 'OUT' | 'ADJUSTMENT',
  quantity: number,
  note?: string
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error('Product not found');
    const movement = await tx.stockMovement.create({ data: { productId, shopId, type, quantity, note } });
    let newQty: number;
    if (type === 'IN') newQty = product.stockQuantity + quantity;
    else if (type === 'OUT') newQty = Math.max(0, product.stockQuantity - quantity);
    else newQty = quantity;
    await tx.product.update({ where: { id: productId }, data: { stockQuantity: newQty } });
    return { movement, newStockQuantity: newQty };
  });
}
