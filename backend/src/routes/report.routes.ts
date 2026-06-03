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

function nonSaleMovementDelta(movementType: string, quantity: number) {
  if (movementType === "PURCHASE_ENTRY" || movementType === "MANUAL_ENTRY") {
    return quantity;
  }

  if (movementType === "MANUAL_EXIT" || movementType === "EXPIRED_PRODUCT") {
    return -quantity;
  }

  return 0;
}

function getPurchasePrice(item: any) {
  return toNumber(item.batch?.purchasePrice ?? item.product?.purchasePrice ?? 0);
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
      .map((product) => ({
        id: product.id,
        name: product.name,
        minStock: product.minStock,
        totalStock: product.batches.reduce(
          (acc, batch) => acc + batch.stock,
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
      salesCreatedInPeriod,
      cancelledSalesInPeriod,
      salesCreatedAfterPeriod,
      cancelledSalesAfterPeriod,
      products,
      movementsInPeriod,
      movementsAfterPeriod,
    ] = await Promise.all([
      prisma.sale.findMany({
        where: {
          createdAt: { gte: start, lt: end },
          status: { in: ["COMPLETED", "CANCELLED"] },
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

      prisma.sale.findMany({
        where: {
          createdAt: { gte: end },
          status: { in: ["COMPLETED", "CANCELLED"] },
        },
        include: {
          items: true,
        },
      }),

      prisma.sale.findMany({
        where: {
          status: "CANCELLED",
          cancelledAt: { gte: end },
        },
        include: {
          items: true,
        },
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

    const totalSoldToday = salesCreatedInPeriod.reduce(
      (acc, sale) => acc + toNumber(sale.total),
      0
    );

    const totalCancelledToday = cancelledSalesInPeriod.reduce(
      (acc, sale) => acc + toNumber(sale.total),
      0
    );

    const profitEstimated = salesCreatedInPeriod.reduce((saleAcc, sale) => {
      const saleProfit = sale.items.reduce((itemAcc, item) => {
        const quantity = toNumber(item.quantity);
        const salePrice = toNumber(item.unitPrice);
        const purchasePrice = getPurchasePrice(item);

        return itemAcc + (salePrice - purchasePrice) * quantity;
      }, 0);

      return saleAcc + saleProfit;
    }, 0);

    const paymentMap = new Map<
      string,
      { method: string; count: number; total: number }
    >();

    salesCreatedInPeriod.forEach((sale) => {
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

    salesCreatedInPeriod.forEach((sale) => {
      sale.items.forEach((item) => {
        const quantity = toNumber(item.quantity);
        const subtotal = toNumber(item.subtotal);
        const salePrice = toNumber(item.unitPrice);
        const purchasePrice = getPurchasePrice(item);
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

    const soldUnitsByProduct = new Map<number, number>();
    const cancelledUnitsByProduct = new Map<number, number>();

    salesCreatedInPeriod.forEach((sale) => {
      sale.items.forEach((item) => {
        const previous = soldUnitsByProduct.get(item.productId) || 0;
        soldUnitsByProduct.set(
          item.productId,
          previous + toNumber(item.quantity)
        );
      });
    });

    cancelledSalesInPeriod.forEach((sale) => {
      sale.items.forEach((item) => {
        const previous = cancelledUnitsByProduct.get(item.productId) || 0;
        cancelledUnitsByProduct.set(
          item.productId,
          previous + toNumber(item.quantity)
        );
      });
    });

    const deltaAfterByProduct = new Map<number, number>();

    movementsAfterPeriod.forEach((movement) => {
      const quantity = toNumber(movement.quantity);
      const delta = nonSaleMovementDelta(movement.movementType, quantity);
      const previous = deltaAfterByProduct.get(movement.productId) || 0;
      deltaAfterByProduct.set(movement.productId, previous + delta);
    });

    salesCreatedAfterPeriod.forEach((sale) => {
      sale.items.forEach((item) => {
        const previous = deltaAfterByProduct.get(item.productId) || 0;
        deltaAfterByProduct.set(
          item.productId,
          previous - toNumber(item.quantity)
        );
      });
    });

    cancelledSalesAfterPeriod.forEach((sale) => {
      sale.items.forEach((item) => {
        const previous = deltaAfterByProduct.get(item.productId) || 0;
        deltaAfterByProduct.set(
          item.productId,
          previous + toNumber(item.quantity)
        );
      });
    });

    const movementSummaryByProduct = new Map<
      number,
      {
        entries: number;
        manualEntries: number;
        manualExits: number;
        expired: number;
      }
    >();

    movementsInPeriod.forEach((movement) => {
      const current =
        movementSummaryByProduct.get(movement.productId) || {
          entries: 0,
          manualEntries: 0,
          manualExits: 0,
          expired: 0,
        };

      const quantity = toNumber(movement.quantity);

      if (movement.movementType === "PURCHASE_ENTRY") {
        current.entries += quantity;
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
          manualEntries: 0,
          manualExits: 0,
          expired: 0,
        };

      const entries = movementSummary.entries + movementSummary.manualEntries;
      const sold = soldUnitsByProduct.get(product.id) || 0;
      const cancelledReturns = cancelledUnitsByProduct.get(product.id) || 0;
      const manualExits = movementSummary.manualExits;
      const expired = movementSummary.expired;

      const finalStock = currentStock - deltaAfter;

      const initialStock =
        finalStock -
        entries -
        cancelledReturns +
        sold +
        manualExits +
        expired;

      return {
        productId: product.id,
        code: product.code,
        name: product.name,
        minStock: product.minStock,
        salePrice: toNumber(product.salePrice),
        initialStock,
        entries,
        sold,
        cancelledReturns,
        manualExits,
        expired,
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
        completedSales: salesCreatedInPeriod.length,
        cancelledSales: cancelledSalesInPeriod.length,
        totalSoldToday,
        totalCancelledToday,
        netTotal: totalSoldToday - totalCancelledToday,
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
      saleDetails: salesCreatedInPeriod.map((sale) => {
        const cancelledAt = sale.cancelledAt
          ? new Date(sale.cancelledAt)
          : null;

        const statusAtClosing =
          cancelledAt && cancelledAt.getTime() < end.getTime()
            ? "CANCELLED"
            : "COMPLETED";

        return {
          id: sale.id,
          createdAt: sale.createdAt,
          paymentMethod: sale.paymentMethod,
          discount: toNumber(sale.discount),
          total: toNumber(sale.total),
          status: statusAtClosing,
        };
      }),
      cancelledSaleDetails: cancelledSalesInPeriod.map((sale) => ({
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
