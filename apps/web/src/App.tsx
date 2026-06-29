import { useState } from 'react';
import { StoreSelector } from '@/components/StoreSelector';
import { PriceTable } from '@/components/PriceTable';
import { usePriceStream } from '@/hooks/usePriceStream';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function App() {
  const [storeId, setStoreId] = useState('store-mumbai-bandra');
  const { prices, status, lastUpdated } = usePriceStream(storeId);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">SurgeOps — Live Price Monitor</h1>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${
            status === 'connected'
              ? 'bg-green-100 text-green-700'
              : status === 'connecting'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {status === 'connected' ? '🟢 Connected' : status === 'connecting' ? '🟡 Connecting' : '🔴 Disconnected'}
          </span>
        </div>

        {/* Store Selector */}
        <StoreSelector value={storeId} onChange={setStoreId} />

        {/* Price Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Live Prices
              {lastUpdated && (
                <span className="ml-3 text-xs text-muted-foreground font-normal">
                  Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PriceTable prices={prices} />
          </CardContent>
        </Card>

      </div>
    </div>
  );
}