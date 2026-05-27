import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { router } from "./routes/index";
import { errorMiddleware } from "./middlewares/error.middleware";

export const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
    : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origen no permitido por CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/", (req, res) => {
  res.json({
    message: "API del Sistema de Botica funcionando correctamente",
    docs: "/api/health",
    environment: process.env.NODE_ENV || "development",
  });
});

app.use("/api", router);
app.use(errorMiddleware);