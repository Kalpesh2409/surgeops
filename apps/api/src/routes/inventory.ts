import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { computeInventoryStatus, computeLevelPercent } from "../lib/inventoryStatus";
import { requireAuth, AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();
const prisma = new PrismaClient();

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

    const snapshot = items.map((item) => {
      const { quantityOnHand, reorderLevel, reorderQty } = item;
      return {
        productId: item.productId,
        name: item.product.name,
        sku: item.product.sku,
        quantityOnHand,
        reorderLevel,
        reorderQty,
        status: computeInventoryStatus(quantityOnHand, reorderLevel),
        levelPercent: computeLevelPercent(quantityOnHand, reorderLevel, reorderQty),
      };
    });

    return res.json({ storeId, count: snapshot.length, inventory: snapshot });
  } catch (err) {
    console.error("[Inventory] GET /:storeId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;