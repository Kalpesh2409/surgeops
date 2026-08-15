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
        isActive: true,
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

// PATCH /users/:id
// Updates an existing user's Name, Email, Role, or Store. Admin-only.
// Password is never changed here — that would need a separate, more
// careful flow (e.g. "reset password") since it involves re-hashing.
router.patch("/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, email, role, storeId } = req.body as {
    name?: string;
    email?: string;
    role?: string;
    storeId?: string;
  };

  if (role) {
    const validRoles = ["ADMIN", "STORE_MANAGER", "REGIONAL_MANAGER"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Role must be ADMIN, STORE_MANAGER, or REGIONAL_MANAGER" });
    }
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        return res.status(409).json({ error: "A user with this email already exists" });
      }
    }

    const effectiveRole = role || existing.role;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        email: email ?? existing.email,
        role: effectiveRole as "ADMIN" | "STORE_MANAGER" | "REGIONAL_MANAGER",
        // Only Store Managers keep a store assignment — clear it for
        // anyone else, same rule as when creating a user.
        storeId: effectiveRole === "STORE_MANAGER" ? (storeId ?? existing.storeId) : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        storeId: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.json({ message: "User updated successfully", user: updatedUser });
  } catch (err) {
    console.error("[Users] PATCH /:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /users/:id
// Soft-deletes a user — sets isActive to false so they can no longer log
// in, but keeps their record for history. Admin-only. Blocks an Admin
// from deactivating their own account, to avoid accidental lockout.
router.delete("/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (req.user?.userId === id) {
    return res.status(400).json({ error: "You cannot deactivate your own account" });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return res.json({ message: "User deactivated successfully" });
  } catch (err) {
    console.error("[Users] DELETE /:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /users/:id/permanent
// Permanently removes a user from the database — cannot be undone.
// Admin-only. Blocks deleting your own account. Only meant to be used
// on accounts that are already deactivated (soft-deleted), as a final
// cleanup step — the frontend enforces this two-step flow.
router.delete("/:id/permanent", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (req.user?.userId === id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (existing.isActive) {
      return res.status(400).json({ error: "User must be deactivated before permanent deletion" });
    }

    await prisma.user.delete({ where: { id } });

    return res.json({ message: "User permanently deleted" });
  } catch (err) {
    console.error("[Users] DELETE /:id/permanent error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;