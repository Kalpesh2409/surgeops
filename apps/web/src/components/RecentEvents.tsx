import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PriceEvent } from '@/hooks/usePriceStream';

interface RecentEventsProps {
  events: PriceEvent[];
}

export function RecentEvents({ events }: RecentEventsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Recent Events</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => {
              const time = new Date(event.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <li key={event.id} className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">{time}</span>{' '}
                  {event.productName} multiplier raised to {event.surgeMultiplier.toFixed(2)}x
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}