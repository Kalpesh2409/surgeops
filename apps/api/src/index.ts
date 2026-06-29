// src/index.ts
// Session 6 patch: Redis graceful disconnect + health router registration
// All other setup (simulator, demandIngestionLoop) unchanged from Sessions 4–5.
import cors from "cors";
import "dotenv/config";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { startSimulator, stopSimulator } from "./services/orderSimulator";
import {
  startDemandIngestionLoop,
  stopDemandIngestionLoop,
} from "./services/demandIngestionLoop";
import { disconnectRedis } from "./lib/redisClient";

// Routes
import { storesRouter as storeRoutes } from "./routes/stores";
import simulatorRoutes from "./routes/simulator";
import pricingRoutes from "./routes/pricing";
import { healthRouter as healthRoutes } from "./routes/health";
import streamRoutes from "./routes/stream";

const app = express();
const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT || "4000", 10);

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// ── Route registration ────────────────────────────────────────────────────────
app.use("/health", healthRoutes); // GET /health  +  GET /health/redis
app.use("/stores", storeRoutes);
app.use("/simulator", simulatorRoutes);
app.use("/pricing", pricingRoutes);
app.use("/stream", streamRoutes);
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

// ── Boot ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] SurgeOps API running on port ${PORT}`);

  if (process.env.SIMULATOR_AUTO_START === "true") {
    startSimulator();
  }

  startDemandIngestionLoop();
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n[Server] ${signal} received — shutting down…`);
  stopSimulator();
  stopDemandIngestionLoop();
  await disconnectRedis(); // ← Session 6: Redis disconnect
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
