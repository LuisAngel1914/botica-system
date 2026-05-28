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

    let profitToday = 0;

    salesToday.forEach((sale: any) => {

      sale.items.forEach((item: any) => {

        const purchasePrice = Number(
          item.product.purchasePrice
        );

        const unitPrice = Number(
          item.unitPrice
        );

        const quantity = Number(
          item.quantity
        );

        const profit =
          (unitPrice - purchasePrice) *
          quantity;

        profitToday += profit;

      });

    });

    // =========================================
    // PRODUCTOS MAS VENDIDOS
    // =========================================

    const productMap: any = {};

    salesToday.forEach((sale: any) => {

      sale.items.forEach((item: any) => {

        const productName = item.product.name;

        if (!productMap[productName]) {
          productMap[productName] = 0;
        }

        productMap[productName] += item.quantity;

      });

    });

    const topSellingProducts = Object.entries(productMap)
      .map(([name, quantity]) => ({
        name,
        quantity,
      }))
      .sort((a: any, b: any) => {
        return Number(b.quantity) - Number(a.quantity);
      })
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
          (acc: number, batch: any) => {
            return acc + batch.stock;
          },
          0
        ),

      }))
      .filter((product) => {
        return product.totalStock <= product.minStock;
      });

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
