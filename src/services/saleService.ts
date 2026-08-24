import prisma from '../config/database';

export interface SaleItemInput {
  productId: string;
  quantity: number;
}

export const createSale = async (shopId: string, items: SaleItemInput[], note?: string) => {
  return await prisma.$transaction(async (tx) => {
    let totalAmount = 0;
    const saleItemsData: { productId: string; quantity: number; unitPrice: number; subtotal: number }[] = [];

    for (const item of items) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, shopId },
      });
      if (!product) throw new Error(`Product ${item.productId} not found.`);
      if (product.stockQuantity < item.quantity) {
        throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stockQuantity}`);
      }
      const subtotal = product.sellingPrice * item.quantity;
      totalAmount += subtotal;
      saleItemsData.push({ productId: item.productId, quantity: item.quantity, unitPrice: product.sellingPrice, subtotal });

      // Deduct stock
      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          shopId,
          type: 'OUT',
          quantity: item.quantity,
          note: 'Sale',
        },
      });
    }

    const sale = await tx.sale.create({
      data: {
        shopId,
        totalAmount,
        note,
        items: { create: saleItemsData },
      },
      include: { items: { include: { product: true } } },
    });

    return sale;
  });
};

export const getSales = async (shopId: string, limit = 20, offset = 0) => {
  return await prisma.sale.findMany({
    where: { shopId },
    include: { items: { include: { product: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
};

export const getSalesSummary = async (shopId: string) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todaySales, weekSales, monthSales, totalCount] = await Promise.all([
    prisma.sale.aggregate({ where: { shopId, createdAt: { gte: startOfDay } }, _sum: { totalAmount: true }, _count: true }),
    prisma.sale.aggregate({ where: { shopId, createdAt: { gte: startOfWeek } }, _sum: { totalAmount: true }, _count: true }),
    prisma.sale.aggregate({ where: { shopId, createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true }, _count: true }),
    prisma.sale.count({ where: { shopId } }),
  ]);

  return {
    today: { revenue: todaySales._sum.totalAmount ?? 0, count: todaySales._count },
    thisWeek: { revenue: weekSales._sum.totalAmount ?? 0, count: weekSales._count },
    thisMonth: { revenue: monthSales._sum.totalAmount ?? 0, count: monthSales._count },
    allTime: { count: totalCount },
  };
};
