import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

// Extends Express's Request type so route handlers can safely read
// req.user after this middleware has run.
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
    storeId: string | null;
  };
}

/**
 * requireAuth
 *
 * Express middleware that verifies the JWT sent in the Authorization
 * header ("Bearer <token>"). Blocks the request with a 401 error if the
 * token is missing or invalid, before it ever reaches the route logic.
 * On success, attaches the decoded user (id, role, storeId) to req.user
 * so downstream handlers can check permissions.
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!JWT_SECRET) {
    console.error("[Auth] JWT_SECRET is not set in .env");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: string;
      storeId: string | null;
    };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * requireAdmin
 *
 * Express middleware that blocks the request unless the logged-in user's
 * role is ADMIN. Must run AFTER requireAuth, since it relies on req.user
 * already being set. Used to protect actions like creating, editing, or
 * deleting staff accounts.
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}