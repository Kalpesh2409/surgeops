import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { requireAuth, requireAdmin, AuthenticatedRequest } from "../middleware/authMiddleware";

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

// POST /users
// Creates a new staff login account. Admin-only — Store Managers and
// Regional Managers cannot create accounts. Password is scrambled with
// bcrypt before saving; it is never stored or returned as plain text.
router.post("/", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, password, role, storeId } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    storeId?: string;
  };

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Name, email, password, and role are required" });
  }

  const validRoles = ["ADMIN", "STORE_MANAGER", "REGIONAL_MANAGER"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Role must be ADMIN, STORE_MANAGER, or REGIONAL_MANAGER" });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role as "ADMIN" | "STORE_MANAGER" | "REGIONAL_MANAGER",
        storeId: role === "STORE_MANAGER" ? storeId || null : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        storeId: true,
        createdAt: true,
      },
    });

    return res.status(201).json({ message: "User created successfully", user: newUser });
  } catch (err) {
    console.error("[Users] POST / error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;