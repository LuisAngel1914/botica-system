import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { httpError } from "../utils/httpError";
import { authMiddleware } from "../middlewares/auth.middleware";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
  newPassword: z
    .string()
    .min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { role: true },
    });

    if (!user || user.status !== "ACTIVE") {
      throw httpError(401, "Credenciales inválidas");
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      throw httpError(401, "Credenciales inválidas");
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role.name,
        fullName: user.fullName,
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role.name,
      },
    });
  })
);

authRouter.get("/me", authMiddleware, (req, res) => {
  res.json({ user: (req as any).user });
});

authRouter.put(
  "/change-password",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const data = changePasswordSchema.parse(req.body);
    const tokenUser = (req as any).user;

    const user = await prisma.user.findUnique({
      where: { id: Number(tokenUser.id) },
    });

    if (!user || user.status !== "ACTIVE") {
      throw httpError(401, "Usuario no encontrado o inactivo");
    }

    const validCurrentPassword = await bcrypt.compare(
      data.currentPassword,
      user.passwordHash
    );

    if (!validCurrentPassword) {
      throw httpError(400, "La contraseña actual es incorrecta");
    }

    const samePassword = await bcrypt.compare(data.newPassword, user.passwordHash);

    if (samePassword) {
      throw httpError(
        400,
        "La nueva contraseña debe ser diferente a la contraseña actual"
      );
    }

    const newPasswordHash = await bcrypt.hash(data.newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    res.json({
      message: "Contraseña actualizada correctamente",
    });
  })
);
