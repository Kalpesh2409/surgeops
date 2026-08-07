import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();
const prisma = new PrismaClient();

// GET /users
// Returns every login account (Admin, Store Manager, Regional Manager).
// Protected — only reachable with a valid login token. Never returns
// passwordHash, since that must stay private even from other logged-in users.
router.get("/", requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        storeId: true,
        store: {
          select: { name: true, city: true },
        },
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return res.json({ count: users.length, users });
  } catch (err) {
    console.error("[Users] GET / error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;