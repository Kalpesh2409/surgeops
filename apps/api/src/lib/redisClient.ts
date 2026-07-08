import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redisInstance.on("connect", () => {
      console.log("[Redis] Connected to", REDIS_URL);
    });

    redisInstance.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    redisInstance.on("reconnecting", () => {
      console.warn("[Redis] Reconnecting...");
    });
  }
  return redisInstance;
}

export async function disconnectRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
    console.log("[Redis] Disconnected gracefully");
  }
}

// Key builders — single source of truth for all cache keys
export const CacheKeys = {
  storePrice: (storeId: string) => `store:${storeId}:prices`,
  productPrice: (storeId: string, productId: string) =>
    `price:${storeId}:${productId}`,
  explanation: (storeId: string, productId: string) =>
    `explanation:${storeId}:${productId}`,
};
