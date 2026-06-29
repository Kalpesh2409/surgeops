import { useEffect, useRef, useState } from 'react';

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
  status: 'connecting' | 'connected' | 'disconnected';
  lastUpdated: string | null;
}

export function usePriceStream(storeId: string): UsePriceStreamResult {
  const [prices, setPrices] = useState<Record<string, PriceEntry>>({});
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!storeId) return;

    setStatus('connecting');
    setPrices({});

    const es = new EventSource(`http://localhost:4000/stream/${storeId}`);
    esRef.current = es;

    es.addEventListener('connected', () => {
      setStatus('connected');
    });

    es.addEventListener('price-update', (e: MessageEvent) => {
      console.log('price-update received:', e.data);
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
      setPrices(prev => ({ ...prev, [data.productId]: data }));
    });

    es.onerror = () => {
      setStatus('disconnected');
      es.close();
    };

    return () => {
      es.close();
      setStatus('disconnected');
    };
  }, [storeId]);

  return { prices, status, lastUpdated };
}