import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { authMiddleware } from "../middlewares/auth.middleware";
import { httpError } from "../utils/httpError";

export const productRouter = Router();

const productSchema = z.object({
  categoryId: z.number().int().optional().nullable(),
  laboratoryId: z.number().int().optional().nullable(),
  code: z.string().min(2),
  barcode: z.string().optional().nullable(),
  name: z.string().min(2),
  activeIngredient: z.string().optional().nullable(),
  presentation: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  purchasePrice: z.number().nonnegative().default(0),
  salePrice: z.number().nonnegative().default(0),
  minStock: z.number().int().nonnegative().default(0),
});

function productSelect() {
  return {
    include: {
      category: true,
      laboratory: true,
      batches: { orderBy: { expirationDate: "asc" as const } },
    },
  };
}

function withStock(product: any) {
  const totalStock = product.batches.reduce((acc: number, batch: any) => acc + batch.stock, 0);
  return { ...product, totalStock };
}

productRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const products = await prisma.product.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q, mode: "insensitive" } },
              { activeIngredient: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      ...productSelect(),
      orderBy: { id: "desc" },
    });
    res.json(products.map(withStock));
  })
);

productRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const product = await prisma.product.findUnique({ where: { id }, ...productSelect() });
    if (!product) throw httpError(404, "Producto no encontrado");
    res.json(withStock(product));
  })
);

productRouter.post(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const data = productSchema.parse(req.body);
    if (data.salePrice < data.purchasePrice) {
      throw httpError(400, "El precio de venta no debe ser menor al precio de compra");
    }
    const product = await prisma.product.create({ data: data as any, ...productSelect() });
    res.status(201).json(withStock(product));
  })
);

productRouter.put(
  "/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = productSchema.partial().parse(req.body);
    if (data.salePrice !== undefined && data.purchasePrice !== undefined && data.salePrice < data.purchasePrice) {
      throw httpError(400, "El precio de venta no debe ser menor al precio de compra");
    }
    const product = await prisma.product.update({ where: { id }, data: data as any, ...productSelect() });
    res.json(withStock(product));
  })
);

productRouter.delete(
  "/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const product = await prisma.product.update({ where: { id }, data: { status: "INACTIVE" }, ...productSelect() });
    res.json(withStock(product));
  })
);
