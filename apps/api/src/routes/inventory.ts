import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { computeInventoryStatus, computeLevelPercent } from "../lib/inventoryStatus";
import { requireAuth, AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();
const prisma = new PrismaClient();

const RATE_WINDOW_HOURS = 2;
const ALERT_THRESHOLD_HOURS = 6;

// GET /inventory/:storeId
router.get("/:storeId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { storeId } = req.params;

  // Store Managers can only ever see their own store's inventory.
  if (req.user?.role === "STORE_MANAGER" && req.user.storeId !== storeId) {
    return res.status(403).json({ error: "You do not have access to this store's inventory" });
  }

  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const items = await prisma.inventory.findMany({
      where: { storeId },
      include: {
        product: {
          select: { id: true, name: true, sku: true },
        },
      },
      orderBy: {
        product: { name: "asc" },
      },
    });

    // Recent sales, used to project stockout timing. Looks at real
    // OrderItem rows (both simulator-generated and real orders) placed
    // within the last RATE_WINDOW_HOURS for this store.
    const windowStart = new Date(Date.now() - RATE_WINDOW_HOURS * 60 * 60 * 1000);
    const recentItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: items.map((i) => i.productId) },
        order: { storeId, placedAt: { gte: windowStart } },
      },
      select: { productId: true, quantity: true },
    });

    const soldByProduct = new Map<string, number>();
    for (const row of recentItems) {
      soldByProduct.set(
        row.productId,
        (soldByProduct.get(row.productId) ?? 0) + row.quantity,
      );
    }

    const snapshot = items.map((item) => {
      const { quantityOnHand, reorderLevel, reorderQty } = item;

      const unitsSoldRecently = soldByProduct.get(item.productId) ?? 0;
      const hourlyRate = unitsSoldRecently / RATE_WINDOW_HOURS;

      // Only project a stockout time when there's real recent sales
      // activity — dividing by zero or projecting from a stale rate
      // would be meaningless.
      let stockoutProjectionHours: number | null = null;
      if (hourlyRate > 0) {
        const hoursRemaining = quantityOnHand / hourlyRate;
        if (hoursRemaining <= ALERT_THRESHOLD_HOURS) {
          stockoutProjectionHours = Math.round(hoursRemaining * 10) / 10;
        }
      }

      return {
        productId: item.productId,
        name: item.product.name,
        sku: item.product.sku,
        quantityOnHand,
        reorderLevel,
        reorderQty,
        status: computeInventoryStatus(quantityOnHand, reorderLevel),
        levelPercent: computeLevelPercent(quantityOnHand, reorderLevel, reorderQty),
        stockoutProjectionHours,
      };
    });

    return res.json({ storeId, count: snapshot.length, inventory: snapshot });
  } catch (err) {
    console.error("[Inventory] GET /:storeId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;