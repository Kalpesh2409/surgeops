import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
const POLL_INTERVAL_MS = 30_000; // 30s — comparison data refreshes every 2min server-side

export interface PriceComparisonEntry {
  productId: string;
  productName: string;
  sku: string;
  basePrice: number;
  rulesEngine: {
    suggestedPrice: number;
    confidence: number;
    updatedAt: string;
  };
  ml: {
    suggestedPrice: number;
    confidence: number;
    updatedAt: string;
  } | null;
  delta: number | null;
}

interface UseMlComparisonResult {
  comparison: PriceComparisonEntry[];
  loading: boolean;
  error: string | null;
}

export function useMlComparison(storeId: string): UseMlComparisonResult {
  const [comparison, setComparison] = useState<PriceComparisonEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/pricing/compare/${storeId}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setComparison(data.comparison ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch comparison");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    setLoading(true);
    fetchComparison();
    const interval = setInterval(fetchComparison, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchComparison]);

  return { comparison, loading, error };
}