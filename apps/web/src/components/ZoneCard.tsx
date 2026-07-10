import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PriceEntry } from '@/hooks/usePriceStream';
import { computeZoneHeat, type ZoneHeatState } from '@/lib/zoneHeat';

interface ZoneCardProps {
  prices: Record<string, PriceEntry>;
}

const STATE_STYLES: Record<ZoneHeatState, { label: string; dot: string; text: string }> = {
  normal: { label: 'Normal', dot: 'bg-status-normal', text: 'text-status-normal' },
  elevated: { label: 'Elevated', dot: 'bg-status-elevated', text: 'text-status-elevated' },
  surge: { label: 'Surge', dot: 'bg-status-surge', text: 'text-status-surge' },
};

export function ZoneCard({ prices }: ZoneCardProps) {
  const { state, surgingCount, totalCount, surgingPercent } = computeZoneHeat(prices);
  const style = STATE_STYLES[state];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Zone Demand Pressure</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">Store Status</span>
          <span className="flex items-center gap-2 text-sm">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${style.dot}`} />
            <span className={`font-medium ${style.text}`}>{style.label}</span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {totalCount === 0
            ? 'No pricing data yet.'
            : `${surgingCount} of ${totalCount} products surging (${surgingPercent.toFixed(0)}%)`}
        </p>
      </CardContent>
    </Card>
  );
}