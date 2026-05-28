import { Router } from "express";
import { prisma } from "../config/prisma";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

export const reportRouter = Router();

reportRouter.get("/dashboard", authMiddleware, asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [productsCount, salesToday, lowStockProducts, expiringBatches] = await Promise.all([
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.sale.findMany({ where: { createdAt: { gte: today, lt: tomorrow }, status: "COMPLETED" } }),
    prisma.product.findMany({ include: { batches: true }, where: { status: "ACTIVE" } }),
    prisma.productBatch.findMany({
      where: {
        stock: { gt: 0 },
        expirationDate: {
          gte: today,
          lte: new Date(today.getTime() + 1000 * 60 * 60 * 24 * 60),
        },
      },
      include: { product: true },
      orderBy: { expirationDate: "asc" },
      take: 20,
    }),
  ]);

  const totalSalesToday = salesToday.reduce((acc, sale) => acc + Number(sale.total), 0);

  const lowStock = lowStockProducts
    .map((product: any) => ({
      id: product.id,
      name: product.name,
      minStock: product.minStock,
      totalStock: product.batches.reduce((acc: number, batch: any) => acc + batch.stock, 0),
    }))
    .filter((product) => product.totalStock <= product.minStock);

  res.json({
    productsCount,
    salesCountToday: salesToday.length,
    totalSalesToday,
    lowStock,
    expiringBatches,
  });
}));
