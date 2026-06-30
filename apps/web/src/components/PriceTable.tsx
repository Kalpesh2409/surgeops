import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { PriceEntry } from '@/hooks/usePriceStream';

interface PriceTableProps {
  prices: Record<string, PriceEntry>;
}

function getSurgeBadge(multiplier: number) {
  if (multiplier >= 1.5) return <Badge variant="destructive">{multiplier.toFixed(2)}x</Badge>;
  if (multiplier >= 1.1) return <Badge className="bg-amber-500 text-white">{multiplier.toFixed(2)}x</Badge>;
  return <Badge className="bg-green-500 text-white">{multiplier.toFixed(2)}x</Badge>;
}

function getReason(multiplier: number) {
  if (multiplier >= 1.5) return 'Heavy demand spike';
  if (multiplier >= 1.1) return 'Normal demand';
  return 'Low inventory';
}

function getConfidenceColor(multiplier: number) {
  if (multiplier >= 1.5) return 'bg-red-500';
  if (multiplier >= 1.1) return 'bg-amber-500';
  return 'bg-green-500';
}

export function PriceTable({ prices }: PriceTableProps) {
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = Object.keys(prices);
    if (ids.length === 0) return;
    setFlashIds(new Set(ids));
    const timer = setTimeout(() => setFlashIds(new Set()), 800);
    return () => clearTimeout(timer);
  }, [prices]);

  const entries = Object.values(prices);

  if (entries.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No price data yet. Select a store to begin.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Base Price (₹)</TableHead>
          <TableHead>Price (₹)</TableHead>
          <TableHead>Surge Multiplier</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Confidence</TableHead>
          <TableHead>Last Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow
            key={entry.productId}
            className={flashIds.has(entry.productId) ? 'bg-yellow-500/20 transition-colors duration-700' : ''}
          >
            <TableCell className="font-medium">{entry.productName}</TableCell>
            <TableCell className="text-muted-foreground">{entry.sku}</TableCell>
            <TableCell className="text-muted-foreground">₹{entry.basePrice.toFixed(2)}</TableCell>
            <TableCell>₹{entry.surgePrice.toFixed(2)}</TableCell>
            <TableCell>{getSurgeBadge(entry.surgeMultiplier)}</TableCell>
            <TableCell className="text-muted-foreground text-sm">{getReason(entry.surgeMultiplier)}</TableCell>
            <TableCell>
              <div className="w-24 h-2 rounded-full bg-muted/50 border border-border overflow-hidden">
                <div
                  className={`h-full ${getConfidenceColor(entry.surgeMultiplier)}`}
                  style={{ width: `${Math.round(entry.confidence * 100)}%` }}
                />
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {new Date(entry.updatedAt).toLocaleTimeString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}