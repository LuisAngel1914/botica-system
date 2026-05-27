import { Router } from "express";
import { prisma } from "../config/prisma";
import { authRouter } from "./auth.routes";
import { productRouter } from "./product.routes";
import { catalogRouter } from "./catalog.routes";
import { purchaseRouter } from "./purchase.routes";
import { saleRouter } from "./sale.routes";
import { inventoryRouter } from "./inventory.routes";
import { cashRouter } from "./cash.routes";
import { reportRouter } from "./report.routes";
import { userRouter } from "./user.routes";

export const router = Router();

router.get("/health", async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({
    status: "ok",
    database: "connected",
    message: "Backend y base de datos funcionando correctamente",
  });
});

router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/catalog", catalogRouter);
router.use("/products", productRouter);
router.use("/inventory", inventoryRouter);
router.use("/purchases", purchaseRouter);
router.use("/sales", saleRouter);
router.use("/cash", cashRouter);
router.use("/reports", reportRouter);
