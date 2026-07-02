import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InventoryItem } from "@/hooks/usePriceStream";

const STATUS_STYLES: Record<InventoryItem["status"], string> = {
  HEALTHY: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  LOW_STOCK: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  CRITICAL: "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<InventoryItem["status"], string> = {
  HEALTHY: "HEALTHY",
  LOW_STOCK: "LOW STOCK",
  CRITICAL: "CRITICAL",
};

const BAR_COLOR: Record<InventoryItem["status"], string> = {
  HEALTHY: "bg-emerald-500",
  LOW_STOCK: "bg-amber-500",
  CRITICAL: "bg-red-500",
};

export function InventoryPanel({
  inventory,
}: {
  inventory: Record<string, InventoryItem>;
}) {
  const items = Object.values(inventory).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">Live Inventory</CardTitle>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">{items.length} SKUs</span>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading inventory…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="pb-2 font-medium">PRODUCT</th>
                <th className="pb-2 font-medium">AVAILABLE</th>
                <th className="pb-2 font-medium">LEVEL</th>
                <th className="pb-2 font-medium">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.productId} className="border-b border-border/50 last:border-0">
                  <td className="py-2 font-medium">{item.name}</td>
                  <td className="py-2 text-muted-foreground">{item.quantityOnHand}</td>
                  <td className="py-2">
                    <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${BAR_COLOR[item.status]}`}
                        style={{ width: `${item.levelPercent}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-2">
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold ${STATUS_STYLES[item.status]}`}
                    >
                      {STATUS_LABELS[item.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}