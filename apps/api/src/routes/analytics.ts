import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();
const prisma = new PrismaClient();

// GET /analytics/sales
// Returns overall sales analytics computed from real orders only —
// synthetic seed data (externalId starting with "SYNTH-") is excluded via
// the same externalId: null filter used elsewhere in the codebase.
router.get("/sales", requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. All real orders, with their store and items (+ product name) attached.
    const orders = await prisma.order.findMany({
      where: { externalId: null },
      include: {
        store: { select: { id: true, name: true, city: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    // 2. Total revenue + total orders — simple sums over the whole set.
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = orders.length;

    // 3. Revenue by store — group orders by storeId, summing totalAmount.
    const revenueByStoreMap = new Map<
      string,
      { storeId: string; storeName: string; city: string; revenue: number }
    >();

    for (const order of orders) {
      const key = order.storeId;
      const existing = revenueByStoreMap.get(key);
      if (existing) {
        existing.revenue += order.totalAmount;
      } else {
        revenueByStoreMap.set(key, {
          storeId: order.storeId,
          storeName: order.store.name,
          city: order.store.city,
          revenue: order.totalAmount,
        });
      }
    }

    const revenueByStore = Array.from(revenueByStoreMap.values()).sort(
      (a, b) => b.revenue - a.revenue,
    );

    const bestStore = revenueByStore[0] || null;

    // 4. Top-selling products — group OrderItems by productId, summing
    // quantity and subtotal revenue across all orders.
    const productMap = new Map<
      string,
      { productId: string; productName: string; unitsSold: number; revenue: number }
    >();

    for (const order of orders) {
      for (const item of order.items) {
        const key = item.productId;
        const existing = productMap.get(key);
        if (existing) {
          existing.unitsSold += item.quantity;
          existing.revenue += item.subtotal;
        } else {
          productMap.set(key, {
            productId: item.productId,
            productName: item.product.name,
            unitsSold: item.quantity,
            revenue: item.subtotal,
          });
        }
      }
    }

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const topProduct = topProducts[0] || null;

    return res.json({
      totalRevenue,
      totalOrders,
      bestStore,
      topProduct,
      topProducts,
      revenueByStore,
    });
  } catch (err) {
    console.error("[Analytics] GET /sales error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;