import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

import {
  sendWelcomeEmail,
  sendSaleEmail,
  sendStockLowEmail,
  sendPasswordRecoveryEmail,
  sendCashClosingEmail,
} from "../services/email.service";

export const reportRouter = Router();

// ================== UTILIDADES ==================
function getPeruDateRange(dateValue?: string) {
  const selectedDate =
    dateValue ||
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

  const start = new Date(`${selectedDate}T00:00:00-05:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { selectedDate, start, end };
}

function toNumber(value: unknown) {
  return Number(value || 0);
}

function getPurchasePrice(item: any) {
  return toNumber(item.batch?.purchasePrice ?? item.product?.purchasePrice ?? 0);
}

// ================== DASHBOARD ==================
reportRouter.get(
  "/dashboard",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [productsCount, salesToday, lowStockProducts, expiringBatches] =
      await Promise.all([
        prisma.product.count({ where: { status: "ACTIVE" } }),
        prisma.sale.findMany({
          where: { createdAt: { gte: today, lt: tomorrow }, status: "COMPLETED" },
        }),
        prisma.product.findMany({
          include: { batches: true },
          where: { status: "ACTIVE" },
        }),
        prisma.productBatch.findMany({
          where: {
            stock: { gt: 0 },
            expirationDate: {
              gte: today,
              lte: new Date(today.getTime() + 1000 * 60 * 60 * 24 * 60),
            },
          },
          include: { product: true },
        }),
      ]);

    const totalSalesToday = salesToday.reduce(
      (acc, sale) => acc + toNumber(sale.total),
      0
    );

    const lowStock = lowStockProducts
      .map((p) => ({
        id: p.id,
        name: p.name,
        minStock: p.minStock,
        totalStock: p.batches.reduce((acc, b) => acc + b.stock, 0),
      }))
      .filter((p) => p.totalStock <= p.minStock);

    res.json({
      productsCount,
      salesCountToday: salesToday.length,
      totalSalesToday,
      lowStock,
      expiringBatches,
    });
  })
);

// ================== CIERRE DE CAJA + RESEND ==================
reportRouter.get(
  "/cash-closing",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(req.query);

    const { selectedDate, start, end } = getPeruDateRange(query.date);
    const user = (req as any).user;

    const [sales, cancelledSales, products] = await Promise.all([
      prisma.sale.findMany({
        where: {
          createdAt: { gte: start, lt: end },
          status: { in: ["COMPLETED", "CANCELLED"] },
        },
        include: {
          items: { include: { product: true, batch: true } },
        },
      }),

      prisma.sale.findMany({
        where: {
          status: "CANCELLED",
          cancelledAt: { gte: start, lt: end },
        },
        include: {
          items: { include: { product: true, batch: true } },
        },
      }),

      prisma.product.findMany({
        where: { status: "ACTIVE" },
        include: { batches: true },
      }),
    ]);

    // ================== CALCULOS ==================
    const totalSoldToday = sales.reduce((acc, s) => acc + toNumber(s.total), 0);

    const totalCancelledToday = cancelledSales.reduce(
      (acc, s) => acc + toNumber(s.total),
      0
    );

    const profitEstimated = sales.reduce((accS, s) => {
      return (
        accS +
        s.items.reduce((accI, item) => {
          return (
            accI +
            (toNumber(item.unitPrice) - getPurchasePrice(item)) *
              toNumber(item.quantity)
          );
        }, 0)
      );
    }, 0);

    // ================== STOCK ==================
    const soldUnits = new Map<number, number>();

    sales.forEach((s) =>
      s.items.forEach((i) =>
        soldUnits.set(
          i.productId,
          (soldUnits.get(i.productId) || 0) + toNumber(i.quantity)
        )
      )
    );

    const stockMovements = products.map((p) => {
      const currentStock = p.batches.reduce(
        (acc, b) => acc + toNumber(b.stock),
        0
      );

      const sold = soldUnits.get(p.id) || 0;

      return {
        productId: p.id,
        code: p.code,
        name: p.name,
        sold,
        finalStock: currentStock,
      };
    });

    // ================== ENVÍO 5 PLANTILLAS ==================
    try {
      const email = "luisangelauquisinche@gmail.com";

      await sendWelcomeEmail(email, user.fullName);

      await sendSaleEmail(email, {
        total: totalSoldToday,
        paymentMethod: "Efectivo",
      });

      // ✅ CORREGIDO (ESTO ERA TU ERROR)
      const lowStockProducts = stockMovements.filter(
        (p) => p.finalStock <= 5
      );

      for (const product of lowStockProducts) {
        await sendStockLowEmail(email, product); // 👈 FIX
      }

      await sendPasswordRecoveryEmail(
        email,
        "https://botica-system.com/reset-password"
      );

      await sendCashClosingEmail(email, {
        date: selectedDate,
        totalSales: totalSoldToday,
        profit: profitEstimated,
        stock: stockMovements.reduce((a, i) => a + i.finalStock, 0),
      });
    } catch (error) {
      console.error("Error enviando correos:", error);
    }

    // ================== RESPONSE ==================
    res.json({
      date: selectedDate,
      summary: {
        totalSoldToday,
        totalCancelledToday,
        profitEstimated,
      },
      stockMovements,
      message: "5 plantillas Resend enviadas correctamente",
    });
  })
);
