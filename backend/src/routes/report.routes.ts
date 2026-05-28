```ts
import { Router } from "express";
import { prisma } from "../config/prisma";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

export const reportRouter = Router();

reportRouter.get(
  "/dashboard",
  authMiddleware,
  asyncHandler(async (req, res) => {

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);



    // =========================================
    // CONSULTAS PRINCIPALES
    // =========================================

    const [
      productsCount,
      salesToday,
      lowStockProducts,
      expiringBatches,
    ] = await Promise.all([

      // Productos activos
      prisma.product.count({
        where: {
          status: "ACTIVE",
        },
      }),

      // Ventas del día
      prisma.sale.findMany({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
          status: "COMPLETED",
        },

        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      }),

      // Productos con stock bajo
      prisma.product.findMany({
        include: {
          batches: true,
        },

        where: {
          status: "ACTIVE",
        },
      }),

      // Productos próximos a vencer
      prisma.productBatch.findMany({
        where: {
          stock: {
            gt: 0,
          },

          expirationDate: {
            gte: today,
            lte: new Date(
              today.getTime() + 1000 * 60 * 60 * 24 * 60
            ),
          },
        },

        include: {
          product: true,
        },

        orderBy: {
          expirationDate: "asc",
        },

        take: 20,
      }),
    ]);



    // =========================================
    // TOTAL VENDIDO HOY
    // =========================================

    const totalSalesToday = salesToday.reduce(
      (acc, sale) => acc + Number(sale.total),
      0
    );



    // =========================================
    // GANANCIA DEL DIA
    // =========================================

    const profitToday = salesToday.reduce(
      (acc: number, sale: any) => {

        const profit = sale.items.reduce(
          (sum: number, item: any) => {

            return (
              sum +
              (
                Number(item.unitPrice) -
                Number(item.product.purchasePrice)
              ) * item.quantity
            );

          },
          0
        );

        return acc + profit;

      },
      0
    );



    // =========================================
    // PRODUCTOS MAS VENDIDOS
    // =========================================

    const topProductsMap: any = {};

    salesToday.forEach((sale: any) => {

      sale.items.forEach((item: any) => {

        const productName = item.product.name;

        if (!topProductsMap[productName]) {
          topProductsMap[productName] = 0;
        }

        topProductsMap[productName] += item.quantity;

      });

    });

    const topSellingProducts = Object.entries(topProductsMap)
      .map(([name, quantity]) => ({
        name,
        quantity,
      }))
      .sort((a: any, b: any) => b.quantity - a.quantity)
      .slice(0, 5);



    // =========================================
    // STOCK BAJO
    // =========================================

    const lowStock = lowStockProducts
      .map((product: any) => ({

        id: product.id,

        name: product.name,

        minStock: product.minStock,

        totalStock: product.batches.reduce(
          (acc: number, batch: any) => acc + batch.stock,
          0
        ),

      }))
      .filter(
        (product) =>
          product.totalStock <= product.minStock
      );



    // =========================================
    // RESPUESTA FINAL
    // =========================================

    res.json({

      // KPIs
      productsCount,

      salesCountToday: salesToday.length,

      totalSalesToday,

      profitToday,



      // Reportes
      topSellingProducts,

      lowStock,

      expiringBatches,

    });

  })
);
```
