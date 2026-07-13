import { useState, useEffect, useRef } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { PriceEntry } from '@/hooks/usePriceStream';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

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

function AnimatedPrice({ value }: { value: number }) {
  const animated = useAnimatedNumber(value, 600);
  return <span>₹{animated.toFixed(2)}</span>;
}

type GlowDirection = 'up' | 'down';

export function PriceTable({ prices }: PriceTableProps) {
  const prevPricesRef = useRef<Record<string, number>>({});
  const [glowMap, setGlowMap] = useState<Record<string, GlowDirection>>({});

  useEffect(() => {
    const prevPrices = prevPricesRef.current;
    const newGlows: Record<string, GlowDirection> = {};

    Object.values(prices).forEach((entry) => {
      const prev = prevPrices[entry.productId];
      if (prev !== undefined && prev !== entry.surgePrice) {
        newGlows[entry.productId] = entry.surgePrice > prev ? 'up' : 'down';
      }
    });

    const nextPrices: Record<string, number> = {};
    Object.values(prices).forEach((entry) => {
      nextPrices[entry.productId] = entry.surgePrice;
    });
    prevPricesRef.current = nextPrices;

    if (Object.keys(newGlows).length === 0) return;

    setGlowMap(newGlows);
    const timer = setTimeout(() => setGlowMap({}), 1300);
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
        {entries.map((entry) => {
          const glow = glowMap[entry.productId];
          return (
            <TableRow
              key={entry.productId}
              className={glow === 'up' ? 'glow-up' : glow === 'down' ? 'glow-down' : ''}
            >
              <TableCell className="font-medium">{entry.productName}</TableCell>
              <TableCell className="text-muted-foreground">{entry.sku}</TableCell>
              <TableCell className="text-muted-foreground">₹{entry.basePrice.toFixed(2)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <AnimatedPrice value={entry.surgePrice} />
                  {entry.explanation && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{entry.explanation}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TableCell>
              <TableCell>{getSurgeBadge(entry.surgeMultiplier)}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{getReason(entry.surgeMultiplier)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-muted/50 border border-border overflow-hidden">
                    <div
                      className={`h-full ${getConfidenceColor(entry.surgeMultiplier)}`}
                      style={{ width: `${Math.max(4, Math.round(entry.confidence * 100))}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8">
                    {Math.round(entry.confidence * 100)}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {new Date(entry.updatedAt).toLocaleTimeString()}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}