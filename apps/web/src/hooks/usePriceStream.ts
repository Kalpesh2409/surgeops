import { useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface PriceEntry {
  productId: string;
  productName: string;
  sku: string;
  basePrice: number;
  surgePrice: number;
  surgeMultiplier: number;
  confidence: number;
  explanation: string | null;
  updatedAt: string;
}

export interface InventoryItem {
  productId: string;
  name: string;
  sku: string;
  quantityOnHand: number;
  reorderLevel: number;
  reorderQty: number;
  status: "HEALTHY" | "LOW_STOCK" | "CRITICAL";
  levelPercent: number;
}

export interface PriceEvent {
  id: string;
  type: "price" | "stock";
  productName: string;
  timestamp: string;
  surgeMultiplier?: number;
  unitsOrdered?: number;
  quantityBefore?: number;
  quantityAfter?: number;
}

interface UsePriceStreamResult {
  prices: Record<string, PriceEntry>;
  inventory: Record<string, InventoryItem>;
  status: ConnectionStatus;
  lastUpdated: string | null;
  events: PriceEvent[];
}

export function usePriceStream(storeId: string): UsePriceStreamResult {
  const [prices, setPrices] = useState<Record<string, PriceEntry>>({});
  const [inventory, setInventory] = useState<Record<string, InventoryItem>>({});
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [events, setEvents] = useState<PriceEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!storeId) return;

    setStatus("connecting");
    setPrices({});
    setInventory({});
    setEvents([]);

    // Initial price load
    fetch(`${API_BASE}/pricing/current/${storeId}`)
      .then((r) => r.json())
      .then((data: { prices: PriceEntry[] }) => {
        const map: Record<string, PriceEntry> = {};
        const list = data.prices ?? data;
        list.forEach((p: PriceEntry) => {
          map[p.productId] = {
            productId: p.productId,
            productName: (p as any).productName ?? p.productId,
            sku: (p as any).sku ?? p.productId,
            basePrice: (p as any).basePrice ?? (p as any).currentPrice,
            surgePrice: (p as any).currentPrice,
            surgeMultiplier: (p as any).surgeMultiplier ?? 1.0,
            confidence: (p as any).confidence ?? 0,
            explanation: (p as any).explanation ?? null,
            updatedAt: p.updatedAt,
          };
        });
        setPrices(map);
        setLastUpdated(new Date().toISOString());
      })
      .catch(() => {});

    // Initial inventory load
    fetch(`${API_BASE}/inventory/${storeId}`)
      .then((r) => r.json())
      .then((data: { inventory: InventoryItem[] }) => {
        const map: Record<string, InventoryItem> = {};
        (data.inventory ?? []).forEach((item) => {
          map[item.productId] = item;
        });
        setInventory(map);
      })
      .catch(() => {});

    const es = new EventSource(`${API_BASE}/stream/${storeId}`);
    esRef.current = es;

    es.addEventListener("connected", () => {
      setStatus("connected");
    });

    es.addEventListener("price-update", (e: MessageEvent) => {
      const raw = JSON.parse(e.data);
      const data: PriceEntry = {
        productId: raw.productId,
        productName: raw.productName ?? raw.productId,
        sku: raw.sku ?? raw.productId,
        basePrice: raw.basePrice ?? raw.currentPrice,
        surgePrice: raw.currentPrice,
        surgeMultiplier: raw.surgeMultiplier,
        confidence: raw.confidence,
        explanation: raw.explanation ?? null,
        updatedAt: raw.updatedAt ?? raw.ts,
      };
      setLastUpdated(new Date().toISOString());
      setPrices((prev) => ({ ...prev, [data.productId]: data }));
      setEvents((prev) => {
        const next: PriceEvent = {
          id: `price-${data.productId}-${data.updatedAt}`,
          type: "price",
          productName: data.productName,
          surgeMultiplier: data.surgeMultiplier,
          timestamp: data.updatedAt,
        };
        // Replace any existing price entry for this product instead of stacking duplicates
        const filtered = prev.filter(
          (ev) => !(ev.type === "price" && ev.productName === data.productName),
        );
        return [next, ...filtered].slice(0, 40);
      });
    });

    es.addEventListener("stock-update", (e: MessageEvent) => {
      const raw = JSON.parse(e.data);
      const item: InventoryItem = {
        productId: raw.productId,
        name: raw.name,
        sku: raw.sku,
        quantityOnHand: raw.quantityAfter,
        reorderLevel: raw.reorderLevel,
        reorderQty: raw.reorderQty,
        status: raw.status,
        levelPercent: raw.levelPercent,
      };
      setInventory((prev) => ({ ...prev, [item.productId]: item }));

      if (raw.unitsOrdered > 0) {
        setEvents((prev) => {
          const next: PriceEvent = {
            id: `stock-${raw.productId}-${raw.updatedAt}`,
            type: "stock",
            productName: raw.name,
            timestamp: raw.updatedAt,
            unitsOrdered: raw.unitsOrdered,
            quantityBefore: raw.quantityBefore,
            quantityAfter: raw.quantityAfter,
          };
          // Replace any existing stock entry for this product instead of stacking duplicates
          const filtered = prev.filter(
            (ev) => !(ev.type === "stock" && ev.productName === raw.name),
          );
          return [next, ...filtered].slice(0, 40);
        });
      }
    });

    es.onerror = () => {
      setStatus("disconnected");
      es.close();
    };

    return () => {
      es.close();
      setStatus("disconnected");
    };
  }, [storeId]);

  return { prices, inventory, status, lastUpdated, events };
}