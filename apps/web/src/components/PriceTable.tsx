import { useState, useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, Lock } from "lucide-react";
import type { PriceEntry } from "@/hooks/usePriceStream";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

interface PriceTableProps {
  prices: Record<string, PriceEntry>;
}

const GLOW_HOLD_MS = 2000;
const ROLL_DURATION_MS = 1000;

function getSurgeBadge(multiplier: number) {
  if (multiplier >= 1.5)
    return (
      <Badge className="bg-status-surge text-white">
        {multiplier.toFixed(2)}x
      </Badge>
    );
  if (multiplier >= 1.1)
    return (
      <Badge className="bg-status-elevated text-white">
        {multiplier.toFixed(2)}x
      </Badge>
    );
  return (
    <Badge className="bg-status-normal text-white">
      {multiplier.toFixed(2)}x
    </Badge>
  );
}

function getReason(multiplier: number) {
  if (multiplier >= 1.5) return "Heavy demand spike";
  if (multiplier >= 1.1) return "Normal demand";
  return "Low inventory";
}

function getConfidenceColor(multiplier: number) {
  if (multiplier >= 1.5) return "bg-status-surge";
  if (multiplier >= 1.1) return "bg-status-elevated";
  return "bg-status-normal";
}

function AnimatedPrice({ value }: { value: number }) {
  const animated = useAnimatedNumber(value, ROLL_DURATION_MS);
  return <span>₹{animated.toFixed(2)}</span>;
}

function AnimatedConfidence({ value }: { value: number }) {
  const animated = useAnimatedNumber(value, ROLL_DURATION_MS);
  return <>{Math.round(animated * 100)}%</>;
}

type GlowDirection = "up" | "down";

interface DisplaySnapshot {
  price: number;
  confidence: number;
  surgeMultiplier: number;
  cappedAtMrp: boolean;
}

interface TrackedSnapshot {
  price: number;
  surgeMultiplier: number;
  cappedAtMrp: boolean;
}

interface QueueItem {
  productId: string;
  direction: GlowDirection;
  target: DisplaySnapshot;
}

export function PriceTable({ prices }: PriceTableProps) {
  const prevSnapshotRef = useRef<Record<string, TrackedSnapshot>>({});
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const [glowMap, setGlowMap] = useState<Record<string, GlowDirection>>({});
  const [displayData, setDisplayData] = useState<Record<string, DisplaySnapshot>>({});

  function processNext() {
    if (processingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;

    processingRef.current = true;
    setGlowMap({ [next.productId]: next.direction });

    setTimeout(() => {
      setDisplayData((d) => ({ ...d, [next.productId]: next.target }));

      setTimeout(() => {
        setGlowMap({});
        processingRef.current = false;
        processNext();
      }, ROLL_DURATION_MS);
    }, GLOW_HOLD_MS);
  }

  useEffect(() => {
    const prevSnapshots = prevSnapshotRef.current;
    const isFirstRun = Object.keys(prevSnapshots).length === 0;

    const nextSnapshots: Record<string, TrackedSnapshot> = {};
    Object.values(prices).forEach((entry) => {
      nextSnapshots[entry.productId] = {
        price: entry.surgePrice,
        surgeMultiplier: entry.surgeMultiplier,
        cappedAtMrp: entry.cappedAtMrp,
      };
    });

    if (isFirstRun) {
      prevSnapshotRef.current = nextSnapshots;
      const initialData: Record<string, DisplaySnapshot> = {};
      Object.values(prices).forEach((entry) => {
        initialData[entry.productId] = {
          price: entry.surgePrice,
          confidence: entry.confidence,
          surgeMultiplier: entry.surgeMultiplier,
          cappedAtMrp: entry.cappedAtMrp,
        };
      });
      setDisplayData(initialData);
      return;
    }

    Object.values(prices).forEach((entry) => {
      const prev = prevSnapshots[entry.productId];
      if (prev === undefined) return;

      const changed =
        prev.price !== entry.surgePrice ||
        prev.surgeMultiplier !== entry.surgeMultiplier ||
        prev.cappedAtMrp !== entry.cappedAtMrp;

      if (changed) {
        const direction: GlowDirection =
          entry.surgePrice > prev.price
            ? "up"
            : entry.surgePrice < prev.price
              ? "down"
              : "up";

        const target: DisplaySnapshot = {
          price: entry.surgePrice,
          confidence: entry.confidence,
          surgeMultiplier: entry.surgeMultiplier,
          cappedAtMrp: entry.cappedAtMrp,
        };
        const existingIndex = queueRef.current.findIndex(
          (q) => q.productId === entry.productId,
        );
        const item: QueueItem = {
          productId: entry.productId,
          direction,
          target,
        };
        if (existingIndex >= 0) {
          queueRef.current[existingIndex] = item;
        } else {
          queueRef.current.push(item);
        }
      }
    });

    prevSnapshotRef.current = nextSnapshots;
    processNext();
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
          <TableHead className="text-center">SKU</TableHead>
          <TableHead className="text-center">Base Price (₹)</TableHead>
          <TableHead className="text-center">Price (₹)</TableHead>
          <TableHead className="text-center">Surge Multiplier</TableHead>
          <TableHead className="text-center">Reason</TableHead>
          <TableHead className="text-center">Confidence</TableHead>
          <TableHead className="text-center">Last Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const glow = glowMap[entry.productId];
          const snapshot: DisplaySnapshot = displayData[entry.productId] ?? {
            price: entry.surgePrice,
            confidence: entry.confidence,
            surgeMultiplier: entry.surgeMultiplier,
            cappedAtMrp: entry.cappedAtMrp,
          };
          return (
            <TableRow
              key={entry.productId}
              className={
                glow === "up" ? "glow-up" : glow === "down" ? "glow-down" : ""
              }
            >
              <TableCell className="font-medium">{entry.productName}</TableCell>
              <TableCell className="text-muted-foreground text-center">
                {entry.sku}
              </TableCell>
              <TableCell className="text-muted-foreground text-center">
                ₹{entry.basePrice.toFixed(2)}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <AnimatedPrice value={snapshot.price} />
                  {snapshot.cappedAtMrp && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className="bg-muted text-foreground border border-border flex items-center gap-1 px-1.5 py-0 text-[10px]">
                          <Lock className="h-2.5 w-2.5" />
                          MRP
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          Price capped at ₹{entry.mrp.toFixed(2)} — India's
                          legal Maximum Retail Price for this product. Demand
                          would have pushed it higher, but MRP can never be
                          exceeded.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
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
              <TableCell className="text-center">
                {getSurgeBadge(snapshot.surgeMultiplier)}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm text-center">
                {snapshot.cappedAtMrp
                  ? "Capped at MRP"
                  : getReason(snapshot.surgeMultiplier)}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-muted/50 border border-border overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${getConfidenceColor(snapshot.surgeMultiplier)}`}
                      style={{
                        width: `${Math.max(4, Math.round(snapshot.confidence * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8">
                    <AnimatedConfidence value={snapshot.confidence} />
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs text-center">
                {new Date(entry.updatedAt).toLocaleTimeString()}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}