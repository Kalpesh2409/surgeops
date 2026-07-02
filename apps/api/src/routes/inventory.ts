import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { computeInventoryStatus, computeLevelPercent } from "../lib/inventoryStatus";

const router = Router();
const prisma = new PrismaClient();

// GET /inventory/:storeId
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