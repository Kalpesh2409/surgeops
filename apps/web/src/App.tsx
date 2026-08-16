import { useEffect, useState } from "react";
import { StoreSelector } from "@/components/StoreSelector";
import { PriceTable } from "@/components/PriceTable";
import { usePriceStream } from "@/hooks/usePriceStream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SystemStatus } from "@/components/SystemStatus";
import { RecentEvents } from "@/components/RecentEvents";
import { InventoryPanel } from "@/components/InventoryPanel";
import { TrafficSimulator } from "@/components/TrafficSimulator";
import { MlComparisonPanel } from "@/components/MlComparisonPanel";
import { ZoneCard } from "@/components/ZoneCard";
import { StockoutAlerts } from "@/components/StockoutAlerts";

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: string;
  storeId: string | null;
}

export default function App() {
  const raw = localStorage.getItem("surgeops-user");
  const user: StoredUser | null = raw ? JSON.parse(raw) : null;

  // Store Managers are locked to their own assigned store — they never
  // see the switcher and can't view another store's data. Everyone else
  // can pick from all stores, defaulting to Bandra or whatever they
  // last viewed.
  const isStoreManager = user?.role === "STORE_MANAGER";
  const lockedStoreId = isStoreManager ? user?.storeId : null;

  const [storeId, setStoreId] = useState(
    () =>
      lockedStoreId ||
      localStorage.getItem("surgeops-selected-store") ||
      "store-mumbai-bandra",
  );
  const { prices, inventory, status, lastUpdated, events } =
    usePriceStream(storeId);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isStoreManager) {
      localStorage.setItem("surgeops-selected-store", storeId);
    }
  }, [storeId, isStoreManager]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const secondsAgo = lastUpdated
    ? Math.max(0, Math.floor((now - new Date(lastUpdated).getTime()) / 1000))
    : null;

  // Traffic Simulator triggers real simulated orders — it's a testing
  // tool, not something Store or Regional Managers need day-to-day.
  const canUseSimulator = user?.role === "ADMIN";

  return (
    <div className="min-h-screen bg-background p-6 overflow-x-hidden">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
              S
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight text-muted-foreground">
                SurgeOps
              </h1>
              <p className="text-xs text-muted-foreground leading-tight">
                Dark Store Pricing Engine
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {isStoreManager ? (
              <span className="text-sm font-medium text-muted-foreground px-3 py-1.5 rounded-lg border border-border">
                {user?.storeId}
              </span>
            ) : (
              <StoreSelector value={storeId} onChange={setStoreId} />
            )}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {status === "connected" && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    status === "connected"
                      ? "bg-green-500"
                      : status === "connecting"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                />
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {status === "connected"
                  ? "LIVE"
                  : status === "connecting"
                    ? "Connecting"
                    : "Disconnected"}
              </span>
              {secondsAgo !== null && (
                <span className="text-xs text-muted-foreground">
                  · Updated {secondsAgo}s ago
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Zone Heat Card */}
        <ZoneCard prices={prices} />

        {/* Price Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Live Prices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PriceTable prices={prices} />
          </CardContent>
        </Card>
        {/* ML Comparison Panel */}
        <MlComparisonPanel storeId={storeId} />

        {/* Stockout Alerts — full width, above the two-column section */}
        <StockoutAlerts inventory={inventory} />

        {/* Bottom panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <InventoryPanel inventory={inventory} />
            <RecentEvents events={events} />
          </div>
          <div className="space-y-6">
            {canUseSimulator && <TrafficSimulator storeId={storeId} />}
            <SystemStatus />
          </div>
        </div>
      </div>
    </div>
  );
}
