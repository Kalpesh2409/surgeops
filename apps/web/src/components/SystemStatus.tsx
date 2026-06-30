import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ServiceState = 'checking' | 'healthy' | 'down';

interface ServiceStatus {
  api: ServiceState;
  postgres: ServiceState;
  redis: ServiceState;
}

function StatusDot({ state }: { state: ServiceState }) {
  const color =
    state === 'healthy' ? 'bg-green-500' : state === 'down' ? 'bg-red-500' : 'bg-yellow-500';
  const label =
    state === 'healthy' ? 'Healthy' : state === 'down' ? 'Down' : 'Checking...';
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

export function SystemStatus() {
  const [status, setStatus] = useState<ServiceStatus>({
    api: 'checking',
    postgres: 'checking',
    redis: 'checking',
  });

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      // API + Postgres come from /health
      try {
        const res = await fetch('http://localhost:4000/health');
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            setStatus((prev) => ({
              ...prev,
              api: data?.status === 'ok' ? 'healthy' : 'down',
              postgres: data?.db === 'connected' ? 'healthy' : 'down',
            }));
          } else {
            setStatus((prev) => ({ ...prev, api: 'down', postgres: 'down' }));
          }
        }
      } catch {
        if (!cancelled) setStatus((prev) => ({ ...prev, api: 'down', postgres: 'down' }));
      }

      // Redis from /health/redis
      try {
        const res = await fetch('http://localhost:4000/health/redis');
        if (!cancelled) {
          const data = await res.json();
          setStatus((prev) => ({ ...prev, redis: data?.status === 'healthy' ? 'healthy' : 'down' }));
        }
      } catch {
        if (!cancelled) setStatus((prev) => ({ ...prev, redis: 'down' }));
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">System Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">API Server</span>
          <StatusDot state={status.api} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">PostgreSQL</span>
          <StatusDot state={status.postgres} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Redis</span>
          <StatusDot state={status.redis} />
        </div>
      </CardContent>
    </Card>
  );
}