import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, Flame, AlertTriangle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

type ButtonConfig = {
  key: string;
  label: string;
  sublabel: string;
  multiplier: number;
  icon: React.ReactNode;
};

const LOAD_BUTTONS: ButtonConfig[] = [
  {
    key: "light",
    label: "+100 Users",
    sublabel: "Light load increase",
    multiplier: 1.3,
    icon: <span className="text-lg">+</span>,
  },
  {
    key: "moderate",
    label: "+500 Users",
    sublabel: "Moderate demand spike",
    multiplier: 2.0,
    icon: <span className="text-lg">++</span>,
  },
  {
    key: "heavy",
    label: "+1000 Users",
    sublabel: "Heavy surge event",
    multiplier: 3.5,
    icon: <Flame className="w-4 h-4 text-status-surge" />,
  },
];

const DDOS_MULTIPLIERS = [2.0, 2.8, 3.5, 4.2, 4.8];
const DDOS_INTERVAL_MS = 1700;

export function TrafficSimulator({ storeId }: { storeId: string }) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [ddosRunning, setDdosRunning] = useState(false);
  const [ddosProgress, setDdosProgress] = useState(0);

  async function inject(multiplier: number) {
    const res = await fetch(`${API_BASE}/simulator/inject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, multiplier }),
    });
    if (!res.ok) throw new Error(`Inject failed: HTTP ${res.status}`);
    return res.json();
  }

  async function handleLoadClick(button: ButtonConfig) {
    if (loadingKey || ddosRunning) return;
    setLoadingKey(button.key);
    try {
      await inject(button.multiplier);
    } catch (err) {
      console.error("[TrafficSimulator] inject failed:", err);
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleDdosClick() {
    if (loadingKey || ddosRunning) return;
    setDdosRunning(true);
    setDdosProgress(0);

    for (let i = 0; i < DDOS_MULTIPLIERS.length; i++) {
      try {
        await inject(DDOS_MULTIPLIERS[i]);
      } catch (err) {
        console.error("[TrafficSimulator] DDoS inject failed:", err);
      }
      setDdosProgress(i + 1);
      if (i < DDOS_MULTIPLIERS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DDOS_INTERVAL_MS));
      }
    }

    setDdosRunning(false);
    setDdosProgress(0);
  }

  const anyRunning = loadingKey !== null || ddosRunning;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Zap className="w-4 h-4 text-status-elevated" />
          Traffic Simulator
        </CardTitle>
        <CardDescription className="text-xs">
          Inject simulated order load into the selected zone and watch surge
          pricing react in real time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {LOAD_BUTTONS.map((button) => (
          <button
            key={button.key}
            onClick={() => handleLoadClick(button)}
            disabled={anyRunning}
            className="w-full flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center w-6">
              {button.icon}
            </span>
            <span>
              <span className="block text-sm font-semibold">
                {loadingKey === button.key ? "Injecting…" : button.label}
              </span>
              <span className="block text-xs text-muted-foreground">
                {button.sublabel}
              </span>
            </span>
          </button>
        ))}

        <button
          onClick={handleDdosClick}
          disabled={anyRunning}
          className="w-full flex items-center gap-3 rounded-lg border border-status-surge/30 bg-status-surge/10 px-4 py-3 text-left transition-colors hover:bg-status-surge/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center justify-center w-6">
            <AlertTriangle className="w-4 h-4 text-status-surge" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-status-surge">
              {ddosRunning
                ? `Simulating… ${ddosProgress}/${DDOS_MULTIPLIERS.length}`
                : "DDoS Simulation"}
            </span>
            <span className="block text-xs text-muted-foreground">
              Extreme stress test
            </span>
          </span>
        </button>
      </CardContent>
    </Card>
  );
}