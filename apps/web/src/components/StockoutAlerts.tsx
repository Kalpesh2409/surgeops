import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { InventoryItem } from "@/hooks/usePriceStream";

function formatHours(hours: number) {
  if (hours < 1) return "under 1 hour";
  const rounded = Math.round(hours * 10) / 10;
  return `~${rounded} ${rounded === 1 ? "hour" : "hours"}`;
}

export function StockoutAlerts({
  inventory,
}: {
  inventory: Record<string, InventoryItem>;
}) {
  const atRiskItems = Object.values(inventory).filter(
    (item) => item.stockoutProjectionHours !== null,
  );

  if (atRiskItems.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-status-elevated" />
          Stockout Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {atRiskItems.map((item) => (
            <div
              key={item.productId}
              className="flex items-start gap-3 rounded-lg border border-status-elevated/30 bg-status-elevated/10 px-3 py-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-status-elevated shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-status-elevated">
                  {item.name} — projected stockout in{" "}
                  {formatHours(item.stockoutProjectionHours!)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Estimated from recent sales activity
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
