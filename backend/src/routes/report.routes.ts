import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

export const reportRouter = Router();

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

function movementDelta(movementType: string, quantity: number) {
  if (
    movementType === "PURCHASE_ENTRY" ||
    movementType === "MANUAL_ENTRY" ||
    movementType === "SALE_CANCEL"
  ) {
    return quantity;
  }

  if (
    movementType === "SALE_EXIT" ||
    movementType === "MANUAL_EXIT" ||
    movementType === "EXPIRED_PRODUCT"
  ) {
    return -quantity;
  }

  return 0;
}

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
          where: {
            createdAt: { gte: today, lt: tomorrow },
            status: "COMPLETED",
          },
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
          orderBy: { expirationDate: "asc" },
          take: 20,
        }),
      ]);

    const totalSalesToday = salesToday.reduce(
      (acc, sale) => acc + Number(sale.total),
      0
    );

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
      .filter((product) => product.totalStock <= product.minStock);

    res.json({
      productsCount,
      salesCountToday: salesToday.length,
      totalSalesToday,
      lowStock,
      expiringBatches,
    });
  })
);

reportRouter.get(
  "/cash-closing",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(req.query);

    const { selectedDate, start, end } = getPeruDateRange(query.date);
    const user = (req as any).user;

    const [
      completedSales,
      cancelledSales,
      products,
      movementsInPeriod,
      movementsAfterPeriod,
    ] = await Promise.all([
      prisma.sale.findMany({
        where: {
          status: "COMPLETED",
          createdAt: { gte: start, lt: end },
        },
        include: {
          user: true,
          items: {
            include: {
              product: true,
              batch: true,
            },
          },
        },
        orderBy: { id: "asc" },
      }),

      prisma.sale.findMany({
        where: {
          status: "CANCELLED",
          cancelledAt: { gte: start, lt: end },
        },
        include: {
          user: true,
          items: {
            include: {
              product: true,
              batch: true,
            },
          },
        },
        orderBy: { id: "asc" },
      }),

      prisma.product.findMany({
        where: { status: "ACTIVE" },
        include: { batches: true },
        orderBy: { name: "asc" },
      }),

      prisma.inventoryMovement.findMany({
        where: {
          createdAt: { gte: start, lt: end },
        },
        include: {
          product: true,
          batch: true,
        },
        orderBy: { id: "asc" },
      }),

      prisma.inventoryMovement.findMany({
        where: {
          createdAt: { gte: end },
        },
        select: {
          productId: true,
          movementType: true,
          quantity: true,
        },
      }),
    ]);

    const totalSoldToday = completedSales.reduce(
      (acc, sale) => acc + toNumber(sale.total),
      0
    );

    const totalCancelledToday = cancelledSales.reduce(
      (acc, sale) => acc + toNumber(sale.total),
      0
    );

    const profitEstimated = completedSales.reduce((saleAcc, sale) => {
      const saleProfit = sale.items.reduce((itemAcc, item) => {
        const quantity = toNumber(item.quantity);
        const salePrice = toNumber(item.unitPrice);
        const purchasePrice = toNumber(item.batch?.purchasePrice);

        return itemAcc + (salePrice - purchasePrice) * quantity;
      }, 0);

      return saleAcc + saleProfit;
    }, 0);

    const paymentMap = new Map<
      string,
      { method: string; count: number; total: number }
    >();

    completedSales.forEach((sale) => {
      const current = paymentMap.get(sale.paymentMethod);
      const total = toNumber(sale.total);

      if (current) {
        paymentMap.set(sale.paymentMethod, {
          ...current,
          count: current.count + 1,
          total: current.total + total,
        });
      } else {
        paymentMap.set(sale.paymentMethod, {
          method: sale.paymentMethod,
          count: 1,
          total,
        });
      }
    });

    const productSoldMap = new Map<
      number,
      {
        productId: number;
        code: string;
        name: string;
        quantity: number;
        total: number;
        profit: number;
      }
    >();

    completedSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const quantity = toNumber(item.quantity);
        const subtotal = toNumber(item.subtotal);
        const salePrice = toNumber(item.unitPrice);
        const purchasePrice = toNumber(item.batch?.purchasePrice);
        const profit = (salePrice - purchasePrice) * quantity;
        const current = productSoldMap.get(item.productId);

        if (current) {
          productSoldMap.set(item.productId, {
            ...current,
            quantity: current.quantity + quantity,
            total: current.total + subtotal,
            profit: current.profit + profit,
          });
        } else {
          productSoldMap.set(item.productId, {
            productId: item.productId,
            code: item.product.code,
            name: item.product.name,
            quantity,
            total: subtotal,
            profit,
          });
        }
      });
    });

    const deltaAfterByProduct = new Map<number, number>();
    const movementSummaryByProduct = new Map<
      number,
      {
        entries: number;
        sold: number;
        cancelledReturns: number;
        manualEntries: number;
        manualExits: number;
        expired: number;
      }
    >();

    movementsAfterPeriod.forEach((movement) => {
      const quantity = toNumber(movement.quantity);
      const delta = movementDelta(movement.movementType, quantity);
      const previous = deltaAfterByProduct.get(movement.productId) || 0;
      deltaAfterByProduct.set(movement.productId, previous + delta);
    });

    movementsInPeriod.forEach((movement) => {
      const current =
        movementSummaryByProduct.get(movement.productId) || {
          entries: 0,
          sold: 0,
          cancelledReturns: 0,
          manualEntries: 0,
          manualExits: 0,
          expired: 0,
        };

      const quantity = toNumber(movement.quantity);

      if (movement.movementType === "PURCHASE_ENTRY") {
        current.entries += quantity;
      }

      if (movement.movementType === "SALE_EXIT") {
        current.sold += quantity;
      }

      if (movement.movementType === "SALE_CANCEL") {
        current.cancelledReturns += quantity;
      }

      if (movement.movementType === "MANUAL_ENTRY") {
        current.manualEntries += quantity;
      }

      if (movement.movementType === "MANUAL_EXIT") {
        current.manualExits += quantity;
      }

      if (movement.movementType === "EXPIRED_PRODUCT") {
        current.expired += quantity;
      }

      movementSummaryByProduct.set(movement.productId, current);
    });

    const stockMovements = products.map((product) => {
      const currentStock = product.batches.reduce(
        (acc, batch) => acc + toNumber(batch.stock),
        0
      );

      const deltaAfter = deltaAfterByProduct.get(product.id) || 0;
      const movementSummary =
        movementSummaryByProduct.get(product.id) || {
          entries: 0,
          sold: 0,
          cancelledReturns: 0,
          manualEntries: 0,
          manualExits: 0,
          expired: 0,
        };

      const deltaPeriod =
        movementSummary.entries +
        movementSummary.manualEntries +
        movementSummary.cancelledReturns -
        movementSummary.sold -
        movementSummary.manualExits -
        movementSummary.expired;

      const finalStock = currentStock - deltaAfter;
      const initialStock = finalStock - deltaPeriod;

      return {
        productId: product.id,
        code: product.code,
        name: product.name,
        minStock: product.minStock,
        salePrice: toNumber(product.salePrice),
        initialStock,
        entries: movementSummary.entries + movementSummary.manualEntries,
        sold: movementSummary.sold,
        cancelledReturns: movementSummary.cancelledReturns,
        manualExits: movementSummary.manualExits,
        expired: movementSummary.expired,
        finalStock,
      };
    });

    const stockInitialTotal = stockMovements.reduce(
      (acc, item) => acc + item.initialStock,
      0
    );

    const stockFinalTotal = stockMovements.reduce(
      (acc, item) => acc + item.finalStock,
      0
    );

    const stockEntriesTotal = stockMovements.reduce(
      (acc, item) => acc + item.entries,
      0
    );

    const stockSoldTotal = stockMovements.reduce(
      (acc, item) => acc + item.sold,
      0
    );

    const stockCancelledReturnTotal = stockMovements.reduce(
      (acc, item) => acc + item.cancelledReturns,
      0
    );

    res.json({
      date: selectedDate,
      generatedAt: new Date(),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      },
      summary: {
        completedSales: completedSales.length,
        cancelledSales: cancelledSales.length,
        totalSoldToday,
        totalCancelledToday,
        profitEstimated,
        stockInitialTotal,
        stockEntriesTotal,
        stockSoldTotal,
        stockCancelledReturnTotal,
        stockFinalTotal,
      },
      paymentMethods: Array.from(paymentMap.values()).sort(
        (a, b) => b.total - a.total
      ),
      productsSold: Array.from(productSoldMap.values()).sort(
        (a, b) => b.total - a.total
      ),
      saleDetails: completedSales.map((sale) => ({
        id: sale.id,
        createdAt: sale.createdAt,
        paymentMethod: sale.paymentMethod,
        discount: toNumber(sale.discount),
        total: toNumber(sale.total),
        status: sale.status,
      })),
      cancelledSaleDetails: cancelledSales.map((sale) => ({
        id: sale.id,
        createdAt: sale.createdAt,
        cancelledAt: sale.cancelledAt,
        paymentMethod: sale.paymentMethod,
        total: toNumber(sale.total),
        cancelReason: sale.cancelReason,
        status: sale.status,
      })),
      stockMovements,
    });
  })
);
