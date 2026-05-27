import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { authMiddleware } from "../middlewares/auth.middleware";

export const catalogRouter = Router();

const nameSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});

catalogRouter.get("/roles", asyncHandler(async (req, res) => {
  res.json(await prisma.role.findMany({ orderBy: { id: "asc" } }));
}));

catalogRouter.get("/categories", asyncHandler(async (req, res) => {
  res.json(await prisma.category.findMany({ orderBy: { name: "asc" } }));
}));

catalogRouter.post("/categories", authMiddleware, asyncHandler(async (req, res) => {
  const data = nameSchema.parse(req.body);
  res.status(201).json(await prisma.category.create({ data }));
}));

catalogRouter.get("/laboratories", asyncHandler(async (req, res) => {
  res.json(await prisma.laboratory.findMany({ orderBy: { name: "asc" } }));
}));

catalogRouter.post("/laboratories", authMiddleware, asyncHandler(async (req, res) => {
  const data = z.object({
    name: z.string().min(2),
    ruc: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }).parse(req.body);
  res.status(201).json(await prisma.laboratory.create({ data }));
}));

catalogRouter.get("/suppliers", asyncHandler(async (req, res) => {
  res.json(await prisma.supplier.findMany({ orderBy: { name: "asc" } }));
}));

catalogRouter.post("/suppliers", authMiddleware, asyncHandler(async (req, res) => {
  const data = z.object({
    name: z.string().min(2),
    ruc: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
  }).parse(req.body);
  res.status(201).json(await prisma.supplier.create({ data }));
}));

catalogRouter.get("/payment-methods", (req, res) => {
  res.json(["CASH", "YAPE", "PLIN", "CARD", "TRANSFER", "MIXED"]);
});
