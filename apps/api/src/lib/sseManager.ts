import { Response } from "express";

// Registry: storeId -> Set of active SSE Response objects
const clients = new Map<string, Set<Response>>();

/**
 * Register a new SSE client for a given store.
 * Called when a browser/client opens GET /stream/:storeId.
 */
export function addClient(storeId: string, res: Response): void {
  if (!clients.has(storeId)) {
    clients.set(storeId, new Set());
  }
  clients.get(storeId)!.add(res);
  console.log(
    `[SSE] Client added for store=${storeId} | total=${clients.get(storeId)!.size}`
  );
}

/**
 * Remove a client when their connection closes.
 * Cleans up the Set (and the Map entry if the Set becomes empty).
 */
export function removeClient(storeId: string, res: Response): void {
  const store = clients.get(storeId);
  if (!store) return;

  store.delete(res);
  console.log(
    `[SSE] Client removed for store=${storeId} | remaining=${store.size}`
  );

  if (store.size === 0) {
    clients.delete(storeId);
  }
}

/**
 * Broadcast a named SSE event to every active client watching a store.
 * Uses the standard SSE wire format:
 *   event: <name>\n
 *   data: <json>\n\n
 */
export function broadcast(
  storeId: string,
  data: Record<string, unknown>,
  eventName = "price-update"
): void {
  const store = clients.get(storeId);
  if (!store || store.size === 0) return;

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const res of store) {
    try {
      res.write(payload);
    } catch (err) {
      // If a write fails the client has already disconnected — remove it silently
      console.warn(`[SSE] Dead client removed for store=${storeId}`);
      store.delete(res);
    }
  }
}