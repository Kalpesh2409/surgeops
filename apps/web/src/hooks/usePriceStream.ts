import { useEffect, useRef, useState } from "react";

export interface PriceEntry {
  productId: string;
  productName: string;
  sku: string;
  basePrice: number;
  surgePrice: number;
  surgeMultiplier: number;
  confidence: number;
  updatedAt: string;
}

interface UsePriceStreamResult {
  prices: Record<string, PriceEntry>;
  status: "connecting" | "connected" | "disconnected";
  lastUpdated: string | null;
}

export function usePriceStream(storeId: string): UsePriceStreamResult {
  const [prices, setPrices] = useState<Record<string, PriceEntry>>({});
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!storeId) return;

    setStatus("connecting");
    setPrices({});

    // Initial load — fetch current prices immediately on mount
    fetch(`http://localhost:4000/pricing/current/${storeId}`)
      .then((r) => r.json())
      .then((data: { prices: PriceEntry[] }) => {
        const map: Record<string, PriceEntry> = {};
        const list = data.prices ?? data;
        list.forEach((p: PriceEntry) => {
          map[p.productId] = {
            productId: p.productId,
            productName: (p as any).productName ?? p.productId,
            sku: (p as any).sku ?? p.productId,
            basePrice: (p as any).currentPrice,
            surgePrice: (p as any).currentPrice,
            surgeMultiplier: (p as any).surgeMultiplier ?? 1.0,
            confidence: (p as any).confidence ?? 0,
            updatedAt: p.updatedAt,
          };
        });
        setPrices(map);
        setLastUpdated(new Date().toISOString());
      })
      .catch(() => {});

    const es = new EventSource(`http://localhost:4000/stream/${storeId}`);
    esRef.current = es;

    es.addEventListener("connected", () => {
      setStatus("connected");
    });

    es.addEventListener("price-update", (e: MessageEvent) => {
      console.log("price-update received:", e.data);
      const raw = JSON.parse(e.data);
      const data: PriceEntry = {
        productId: raw.productId,
        productName: raw.productName ?? raw.productId,
        sku: raw.sku ?? raw.productId,
        basePrice: raw.basePrice ?? raw.currentPrice,
        surgePrice: raw.currentPrice,
        surgeMultiplier: raw.surgeMultiplier,
        confidence: raw.confidence,
        updatedAt: raw.updatedAt ?? raw.ts,
      };
      setLastUpdated(new Date().toISOString());
      setPrices((prev) => ({ ...prev, [data.productId]: data }));
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

  return { prices, status, lastUpdated };
}
