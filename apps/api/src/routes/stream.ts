import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { addClient, removeClient } from "../lib/sseManager";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * GET /stream/:storeId
 *
 * Opens a persistent Server-Sent Events connection for the given store.
 * The client receives:
 *   - an immediate `connected` event on open
 *   - `price-update` events whenever priceUpdateWriter broadcasts a change
 *
 * Auth note: browsers' EventSource API cannot send custom headers, so the
 * login token is passed as a query param (?token=...) instead of the usual
 * Authorization header. Verified the same way requireAuth does elsewhere.
 * Store Managers are additionally restricted to their own assigned store.
 *
 * Compatible with:
 *   - Browser EventSource API
 *   - curl -N "http://localhost:4000/stream/<storeId>?token=<token>"
 *   - Postman SSE view
 */
router.get("/:storeId", (req: Request, res: Response) => {
  const { storeId } = req.params;
  const { token } = req.query as { token?: string };

  if (!JWT_SECRET) {
    console.error("[Stream] JWT_SECRET is not set in .env");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  let decoded: { userId: string; role: string; storeId: string | null };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as typeof decoded;
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (decoded.role === "STORE_MANAGER" && decoded.storeId !== storeId) {
    return res.status(403).json({ error: "You do not have access to this store's stream" });
  }

  // ── SSE headers ────────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Allow browser EventSource from any origin (CORS for SSE)
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Disable Nginx / proxy buffering so events flush immediately
  res.setHeader("X-Accel-Buffering", "no");

  // Flush headers to the client right away
  res.flushHeaders();

  // ── Register this client ───────────────────────────────────────────────────
  addClient(storeId, res);

  // ── Send immediate confirmation event ─────────────────────────────────────
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      storeId,
      message: "SSE stream connected",
      ts: new Date().toISOString(),
    })}\n\n`
  );

  // ── Heartbeat — keeps the connection alive through idle periods ────────────
  const heartbeat = setInterval(() => {
    try {
      // SSE comment line (`:`) — ignored by EventSource but prevents timeout
      res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000); // every 25 s

  // ── Cleanup on client disconnect ───────────────────────────────────────────
  req.on("close", () => {
    clearInterval(heartbeat);
    removeClient(storeId, res);
  });
});

export default router;