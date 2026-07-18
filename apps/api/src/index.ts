// src/index.ts
// Session 6 patch: Redis graceful disconnect + health router registration
// Session 14: wired mlSuggestionLoop into boot + shutdown alongside demandIngestionLoop.
// Session 24: split Express app config into app.ts for testability.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { app } from "./app";
import { startSimulator, stopSimulator } from "./services/orderSimulator";
import {
  startDemandIngestionLoop,
  stopDemandIngestionLoop,
} from "./services/demandIngestionLoop";
import {
  startMlSuggestionLoop,
  stopMlSuggestionLoop,
} from "./services/mlSuggestionLoop";
import { disconnectRedis } from "./lib/redisClient";

const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT || "4000", 10);

// ── Boot ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] SurgeOps API running on port ${PORT}`);

  if (process.env.SIMULATOR_AUTO_START === "true") {
    startSimulator();
  }

  startDemandIngestionLoop();
  startMlSuggestionLoop();
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n[Server] ${signal} received — shutting down…`);
  stopSimulator();
  stopDemandIngestionLoop();
  stopMlSuggestionLoop();
  await disconnectRedis(); // ← Session 6: Redis disconnect
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));