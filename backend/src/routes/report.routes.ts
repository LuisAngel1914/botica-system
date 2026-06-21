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
  sendCashClosingEmail 
} from "../services/email.service";

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

function getPurchasePrice(item: any) {
  return toNumber(item.batch?.purchasePrice ?? item.product?.purchasePrice ?? 0);
}

function nonSaleMovementDelta(movementType: string, quantity: number) {
  if (movementType === "PURCHASE_ENTRY" || movementType === "MANUAL_ENTRY") return quantity;
  if (movementType === "MANUAL_EXIT" || movementType === "EXPIRED_PRODUCT") return -quantity;
  return 0;
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

    const [productsCount, salesToday, lowStockProducts, expiringBatches] = await Promise.all([
      prisma.product.count({ where: { status: "ACTIVE" } }),
      prisma.sale.findMany({ where: { createdAt: { gte: today, lt: tomorrow }, status: "COMPLETED" } }),
      prisma.product.findMany({ include: { batches: true }, where: { status: "ACTIVE" } }),
      prisma.productBatch.findMany({
        where: { stock: { gt: 0 }, expirationDate: { gte: today, lte: new Date(today.getTime() + 1000 * 60 * 60 * 24 * 60) } },
        include: { product: true }, orderBy: { expirationDate: "asc" }, take: 20,
      }),
    ]);

    const totalSalesToday = salesToday.reduce((acc, sale) => acc + toNumber(sale.total), 0);
    const lowStock = lowStockProducts
      .map(p => ({ id: p.id, name: p.name, minStock: p.minStock, totalStock: p.batches.reduce((acc, b) => acc + b.stock, 0) }))
      .filter(p => p.totalStock <= p.minStock);

    res.json({ productsCount, salesCountToday: salesToday.length, totalSalesToday, lowStock, expiringBatches });
  })
);

// ================== CIERRE DE CAJA + RESEND ==================
reportRouter.get(
  "/cash-closing",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const query = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.query);
    const { selectedDate, start, end } = getPeruDateRange(query.date);
    const user = (req as any).user;

    // Obtener ventas, anulaciones y productos
    const [sales, cancelledSales, products] = await Promise.all([
      prisma.sale.findMany({ where: { createdAt: { gte: start, lt: end }, status: { in: ["COMPLETED", "CANCELLED"] } }, include: { user: true, items: { include: { product: true, batch: true } } } }),
      prisma.sale.findMany({ where: { status: "CANCELLED", cancelledAt: { gte: start, lt: end } }, include: { user: true, items: { include: { product: true, batch: true } } } }),
      prisma.product.findMany({ where: { status: "ACTIVE" }, include: { batches: true } }),
    ]);

    // Totales y ganancias
    const totalSoldToday = sales.reduce((acc, s) => acc + toNumber(s.total), 0);
    const totalCancelledToday = cancelledSales.reduce((acc, s) => acc + toNumber(s.total), 0);
    const profitEstimated = sales.reduce((accS, s) =>
      accS + s.items.reduce((accI, item) => accI + (toNumber(item.unitPrice) - getPurchasePrice(item)) * toNumber(item.quantity), 0)
    , 0);

    // Productos vendidos
    const productSoldMap = new Map<number, { code: string; name: string; quantity: number; total: number; profit: number }>();
    sales.forEach(s => s.items.forEach(item => {
      const q = toNumber(item.quantity);
      const subtotal = toNumber(item.subtotal);
      const profit = (toNumber(item.unitPrice) - getPurchasePrice(item)) * q;
      const current = productSoldMap.get(item.productId);
      if (current) productSoldMap.set(item.productId, { ...current, quantity: current.quantity + q, total: current.total + subtotal, profit: current.profit + profit });
      else productSoldMap.set(item.productId, { code: item.product.code, name: item.product.name, quantity: q, total: subtotal, profit });
    }));

    // STOCK FINAL
    const soldUnitsByProduct = new Map<number, number>();
    const cancelledUnitsByProduct = new Map<number, number>();
    sales.forEach(s => s.items.forEach(i => soldUnitsByProduct.set(i.productId, (soldUnitsByProduct.get(i.productId) || 0) + toNumber(i.quantity))));
    cancelledSales.forEach(s => s.items.forEach(i => cancelledUnitsByProduct.set(i.productId, (cancelledUnitsByProduct.get(i.productId) || 0) + toNumber(i.quantity))));

    const stockMovements = products.map(p => {
      const currentStock = p.batches.reduce((acc, b) => acc + toNumber(b.stock), 0);
      const sold = soldUnitsByProduct.get(p.id) || 0;
      const cancelled = cancelledUnitsByProduct.get(p.id) || 0;
      const finalStock = currentStock;
      const initialStock = finalStock - sold + cancelled;
      return { productId: p.id, code: p.code, name: p.name, initialStock, sold, cancelledReturns: cancelled, finalStock };
    });

    // === ENVÍO DE CORREOS (5 PLANTILLAS) ===
    try {
      // 1. Bienvenida (simulación)
      await sendWelcomeEmail(user.email, user.fullName);

      // 2. Venta confirmada
      await sendSaleEmail(user.email, { total: totalSoldToday, paymentMethod: "Efectivo" });

      // 3. Stock bajo (si hay alguno)
      stockMovements.filter(p => p.finalStock <= 5).forEach(async p => await sendStockLowEmail(user.email, p));

      // 4. Recuperar contraseña (simulación)
      await sendPasswordRecoveryEmail(user.email, "https://botica-system.com/reset-password");

      // 5. Cierre de caja real
      await sendCashClosingEmail(user.email, { date: selectedDate, totalSales: totalSoldToday, profit: profitEstimated, stock: stockMovements.reduce((acc, i) => acc + i.finalStock, 0) });
    } catch (error) {
      console.error("Error enviando alguno de los 5 correos:", error);
    }

    res.json({
      date: selectedDate,
      summary: { totalSoldToday, totalCancelledToday, profitEstimated },
      productsSold: Array.from(productSoldMap.values()),
      stockMovements,
      message: "Se enviaron las 5 plantillas de prueba al correo."
    });
  })
);
