// src/app.ts
// Express app configuration, separated from server boot for testability.
import cors from "cors";
import express from "express";

// Routes
import { storesRouter as storeRoutes } from "./routes/stores";
import simulatorRoutes from "./routes/simulator";
import pricingRoutes from "./routes/pricing";
import { healthRouter as healthRoutes } from "./routes/health";
import streamRoutes from "./routes/stream";
import inventoryRoutes from "./routes/inventory";
import authRoutes from "./routes/auth";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter((origin): origin is string => Boolean(origin));

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// ── Route registration ────────────────────────────────────────────────────────
app.use("/health", healthRoutes); // GET /health  +  GET /health/redis
app.use("/stores", storeRoutes);
app.use("/simulator", simulatorRoutes);
app.use("/pricing", pricingRoutes);
app.use("/stream", streamRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/auth", authRoutes); // POST /auth/login

// ── Centralized error handler ─────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[Error]", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  },
);

export { app };