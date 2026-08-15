import { Router, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthenticatedRequest } from "../middleware/authMiddleware";

export const storesRouter = Router();

// GET /stores — list all 4 dark stores
storesRouter.get(
  "/",
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stores = await prisma.store.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          city: true,
          pincode: true,
          lat: true,
          lng: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: { inventory: true },
          },
        },
      });

      res.json({
        success: true,
        count: stores.length,
        data: stores,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /stores/:id/inventory — full inventory for a single store
storesRouter.get(
  "/:id/inventory",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Store Managers can only ever see their own store's inventory,
      // even if someone tries to request a different store ID directly.
      if (req.user?.role === "STORE_MANAGER" && req.user.storeId !== id) {
        res.status(403).json({
          success: false,
          error: "You do not have access to this store's inventory",
        });
        return;
      }

      const store = await prisma.store.findUnique({
        where: { id },
      });

      if (!store) {
        res
          .status(404)
          .json({ success: false, error: `Store '${id}' not found` });
        return;
      }

      const inventory = await prisma.inventory.findMany({
        where: { storeId: id },
        include: {
          product: {
            include: { category: true },
          },
        },
        orderBy: [
          { product: { category: { name: "asc" } } },
          { product: { name: "asc" } },
        ],
      });

      
      // Annotate each item with a stock status for easy frontend use
      const annotated = inventory.map((item) => ({
        inventoryId: item.id,
        product: {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          basePrice: item.product.basePrice,
          unit: item.product.unit,
          category: item.product.category.name,
        },
        stock: {
          quantity: item.quantityOnHand,
          reorderLevel: item.reorderLevel,
          reorderQty: item.reorderQty,
          status:
            item.quantityOnHand === 0
              ? "OUT_OF_STOCK"
              : item.quantityOnHand <= item.reorderLevel
                ? "LOW_STOCK"
                : "IN_STOCK",
        },
        currentPrice: item.currentPrice,
        updatedAt: item.updatedAt,
      }));

      res.json({
        success: true,
        store: { id: store.id, name: store.name, city: store.city },
        count: annotated.length,
        summary: {
          inStock: annotated.filter((i) => i.stock.status === "IN_STOCK")
            .length,
          lowStock: annotated.filter((i) => i.stock.status === "LOW_STOCK")
            .length,
          outOfStock: annotated.filter((i) => i.stock.status === "OUT_OF_STOCK")
            .length,
        },
        data: annotated,
      });
    } catch (err) {
      next(err);
    }
  },
);