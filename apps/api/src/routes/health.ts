import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { getRedis } from "../lib/redisClient";

const router = Router();
const prisma = new PrismaClient();

// GET /health
router.get("/", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

// GET /health/redis
router.get("/redis", async (_req: Request, res: Response) => {
  const redis = getRedis();

  try {
    // Ping
    const ping = await redis.ping();

    // INFO memory section
    const info = await redis.info("memory");
    const usedMemoryMatch = info.match(/used_memory_human:(.+)/);
    const usedMemory = usedMemoryMatch ? usedMemoryMatch[1].trim() : "unknown";

    // Count all surgeops keys
    const allKeys = await redis.keys("*");
    const surgeOpsKeys = allKeys.filter(
      (k) => k.startsWith("store:") || k.startsWith("price:")
    );

    // Break down by type
    const storeKeys = surgeOpsKeys.filter((k) => k.startsWith("store:"));
    const productKeys = surgeOpsKeys.filter((k) => k.startsWith("price:"));

    res.json({
      status: ping === "PONG" ? "healthy" : "degraded",
      ping,
      memory: {
        used: usedMemory,
      },
      keys: {
        total: surgeOpsKeys.length,
        storeAggregates: storeKeys.length,
        productPrices: productKeys.length,
        sample: surgeOpsKeys.slice(0, 10),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: "unhealthy",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export const healthRouter = router;