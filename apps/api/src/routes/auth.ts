import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;

// POST /auth/login
router.post("/login", async (req: Request, res: Response) => {
  if (!JWT_SECRET) {
    console.error("[Auth] JWT_SECRET is not set in .env");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        storeId: user.storeId,
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeId: user.storeId,
      },
    });
  } catch (err) {
    console.error("[Auth] /login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;