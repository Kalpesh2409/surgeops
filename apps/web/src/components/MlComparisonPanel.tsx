import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMlComparison } from "@/hooks/useMlComparison";

interface MlComparisonPanelProps {
  storeId: string;
}

function getDeltaBadge(delta: number | null) {
  if (delta === null) return <Badge variant="outline">—</Badge>;
  if (delta > 0)
    return (
      <Badge className="bg-status-elevated text-white">+₹{delta.toFixed(2)}</Badge>
    );
  if (delta < 0)
    return (
      <Badge className="bg-blue-500 text-white">₹{delta.toFixed(2)}</Badge>
    );
  return <Badge className="bg-status-normal text-white">₹0.00</Badge>;
}

export function MlComparisonPanel({ storeId }: MlComparisonPanelProps) {
  const { comparison, loading, error } = useMlComparison(storeId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Live Price vs Pure ML Baseline
        </CardTitle>
        <CardDescription className="text-xs">
          Comparing the actual live price (ML baseline + real-time surge,
          guardrail-clamped) against the model's raw baseline prediction with no
          surge applied
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && comparison.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            Loading comparison data...
          </div>
        ) : error ? (
          <div className="text-center text-status-surge py-12">Error: {error}</div>
        ) : comparison.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            No comparison data yet. Select a store to begin.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-center">SKU</TableHead>
                <TableHead className="text-center">Base Price (₹)</TableHead>
                <TableHead className="text-center">Live Price (₹)</TableHead>
                <TableHead className="text-center">Pure ML Baseline (₹)</TableHead>
                <TableHead className="text-center">Surge Premium</TableHead>
                <TableHead className="text-center">ML Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.map((entry) => (
                <TableRow key={entry.productId}>
                  <TableCell className="font-medium">
                    {entry.productName}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-center">
                    {entry.sku}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-center">
                    ₹{entry.basePrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    ₹{entry.rulesEngine.suggestedPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    {entry.ml ? (
                      `₹${entry.ml.suggestedPrice.toFixed(2)}`
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{getDeltaBadge(entry.delta)}</TableCell>
                  <TableCell>
                    {entry.ml ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-muted/50 border border-border overflow-hidden">
                          <div
                            className="h-full bg-teal-500"
                            style={{
                              width: `${Math.max(4, Math.round(entry.ml.confidence * 100))}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8">
                          {Math.round(entry.ml.confidence * 100)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}