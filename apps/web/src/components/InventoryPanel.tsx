import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InventoryItem } from "@/hooks/usePriceStream";

const STATUS_STYLES: Record<InventoryItem["status"], string> = {
  HEALTHY: "bg-status-normal/15 text-status-normal border-status-normal/30",
  LOW_STOCK: "bg-status-elevated/15 text-status-elevated border-status-elevated/30",
  CRITICAL: "bg-status-surge/15 text-status-surge border-status-surge/30",
};

const STATUS_LABELS: Record<InventoryItem["status"], string> = {
  HEALTHY: "HEALTHY",
  LOW_STOCK: "LOW STOCK",
  CRITICAL: "CRITICAL",
};

const BAR_COLOR: Record<InventoryItem["status"], string> = {
  HEALTHY: "bg-status-normal",
  LOW_STOCK: "bg-status-elevated",
  CRITICAL: "bg-status-surge",
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
          <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="pb-2 font-medium whitespace-nowrap">PRODUCT</th>
                  <th className="pb-2 font-medium text-center whitespace-nowrap">AVAILABLE</th>
                  <th className="pb-2 font-medium text-center whitespace-nowrap">LEVEL</th>
                  <th className="pb-2 font-medium text-center whitespace-nowrap">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.productId} className="border-b border-border/50 last:border-0">
                    <td className="py-2 font-medium whitespace-nowrap">{item.name}</td>
                    <td className="py-2 text-muted-foreground text-center whitespace-nowrap">{item.quantityOnHand}</td>
                    <td className="py-2">
                      <div className="flex items-center justify-center">
                        <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${BAR_COLOR[item.status]}`}
                            style={{ width: `${item.levelPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-center">
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[item.status]}`}
                        >
                          {STATUS_LABELS[item.status]}
                        </Badge>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}