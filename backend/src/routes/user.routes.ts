import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

export const userRouter = Router();

const createUserSchema = z.object({
  roleId: z.number().int(),
  fullName: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
});

userRouter.get(
  "/",
  authMiddleware,
  requireRole("Administrador"),
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      include: { role: true },
      orderBy: { id: "asc" },
    });
    res.json(users.map(({ passwordHash, ...user }) => user));
  })
);

userRouter.post(
  "/",
  authMiddleware,
  requireRole("Administrador"),
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        roleId: data.roleId,
        fullName: data.fullName,
        email: data.email,
        passwordHash,
      },
      include: { role: true },
    });

    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  })
);
