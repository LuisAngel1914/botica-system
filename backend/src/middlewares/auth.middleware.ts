import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token no enviado" });
  }

  const token = header.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido o vencido" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "No tiene permisos para esta acción" });
    }
    next();
  };
}
