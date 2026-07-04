import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PriceEvent } from '@/hooks/usePriceStream';

interface RecentEventsProps {
  events: PriceEvent[];
}

const MAX_PER_COLUMN = 8;

export function RecentEvents({ events }: RecentEventsProps) {
  const priceEvents = events.filter((e) => e.type === 'price').slice(0, MAX_PER_COLUMN);
  const stockEvents = events.filter((e) => e.type === 'stock').slice(0, MAX_PER_COLUMN);

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Recent Events</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Price changes */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                PRICE CHANGES
              </p>
              {priceEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No price changes yet.</p>
              ) : (
                <ul className="space-y-2">
                  {priceEvents.map((event) => (
                    <li key={event.id} className="text-sm text-muted-foreground">
                      <span className="text-foreground font-medium">
                        {formatTime(event.timestamp)}
                      </span>{' '}
                      {event.productName} → {event.surgeMultiplier?.toFixed(2)}x
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Stock changes */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                STOCK CHANGES
              </p>
              {stockEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stock changes yet.</p>
              ) : (
                <ul className="space-y-2">
                  {stockEvents.map((event) => (
                    <li key={event.id} className="text-sm text-muted-foreground">
                      <span className="text-foreground font-medium">
                        {formatTime(event.timestamp)}
                      </span>{' '}
                      {event.productName} ({event.quantityBefore} → {event.quantityAfter})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}