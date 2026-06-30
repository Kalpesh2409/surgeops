import { useEffect, useState } from "react";
import { StoreSelector } from "@/components/StoreSelector";
import { PriceTable } from "@/components/PriceTable";
import { usePriceStream } from "@/hooks/usePriceStream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SystemStatus } from "@/components/SystemStatus";
import { RecentEvents } from "@/components/RecentEvents";

export default function App() {
  const [storeId, setStoreId] = useState("store-mumbai-bandra");
  const { prices, status, lastUpdated, events } = usePriceStream(storeId);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const secondsAgo = lastUpdated
    ? Math.max(0, Math.floor((now - new Date(lastUpdated).getTime()) / 1000))
    : null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
              S
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">SurgeOps</h1>
              <p className="text-xs text-muted-foreground leading-tight">
                Dark Store Pricing Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <StoreSelector value={storeId} onChange={setStoreId} />
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

        {/* Bottom panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SystemStatus />
          <RecentEvents events={events} />
        </div>
      </div>
    </div>
  );
}
