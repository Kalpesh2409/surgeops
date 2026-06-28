import { Router, Request, Response } from "express";
import { addClient, removeClient } from "../lib/sseManager";

const router = Router();

/**
 * GET /stream/:storeId
 *
 * Opens a persistent Server-Sent Events connection for the given store.
 * The client receives:
 *   - an immediate `connected` event on open
 *   - `price-update` events whenever priceUpdateWriter broadcasts a change
 *
 * Compatible with:
 *   - Browser EventSource API
 *   - curl -N http://localhost:4000/stream/<storeId>
 *   - Postman SSE view
 */
router.get("/:storeId", (req: Request, res: Response) => {
  const { storeId } = req.params;

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