import { NextFunction, Request, Response } from "express";

export function errorMiddleware(error: any, req: Request, res: Response, next: NextFunction) {
  console.error(error);

  const status = error.status || 500;
  const message = error.message || "Error interno del servidor";

  res.status(status).json({
    message,
    detail: process.env.NODE_ENV === "development" ? error?.stack : undefined,
  });
}
