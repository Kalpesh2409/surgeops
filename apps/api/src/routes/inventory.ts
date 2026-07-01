import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// GET /inventory/:storeId
// Returns inventory snapshot for all products in a store, with computed
// status (HEALTHY | LOW_STOCK | CRITICAL) and level fill percentage.
router.get("/:storeId", async (req: Request, res: Response) => {
  const { storeId } = req.params;

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

    const snapshot = items.map((item) => {
      const { quantityOnHand, reorderLevel, reorderQty } = item;

      const criticalThreshold = Math.max(reorderLevel * 0.5, 5);
      let status: "HEALTHY" | "LOW_STOCK" | "CRITICAL";
      if (quantityOnHand <= criticalThreshold) {
        status = "CRITICAL";
      } else if (quantityOnHand <= reorderLevel) {
        status = "LOW_STOCK";
      } else {
        status = "HEALTHY";
      }

      const fullStockTarget = reorderLevel + reorderQty;
      const levelPercent =
        fullStockTarget > 0
          ? Math.min(100, Math.round((quantityOnHand / fullStockTarget) * 100))
          : 0;

      return {
        productId: item.productId,
        name: item.product.name,
        sku: item.product.sku,
        quantityOnHand,
        reorderLevel,
        reorderQty,
        status,
        levelPercent,
      };
    });

    return res.json({ storeId, count: snapshot.length, inventory: snapshot });
  } catch (err) {
    console.error("[Inventory] GET /:storeId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;