/**
 * index.ts
 * Entry point — starts Express server, order simulator, and pricing engine.
 * Session 4: simulator auto-starts on boot.
 * Session 5: demand ingestion loop auto-starts on boot.
 */

import app from './app';
import { startSimulator } from './services/orderSimulator';
import { startDemandIngestionLoop, stopDemandIngestionLoop } from './services/demandIngestionLoop';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Simulator tick interval from env (default 30s)
const SIMULATOR_INTERVAL_MS = process.env.SIMULATOR_INTERVAL_MS
  ? parseInt(process.env.SIMULATOR_INTERVAL_MS)
  : 30_000;

const server = app.listen(PORT, () => {
  console.log(`[SurgeOps] API server running on port ${PORT}`);
  console.log(`[SurgeOps] Environment: ${process.env.NODE_ENV ?? 'development'}`);

  // Auto-start simulator (can be toggled via /simulator/stop)
  const autoStart = process.env.SIMULATOR_AUTO_START !== 'false';
  if (autoStart) {
    startSimulator(SIMULATOR_INTERVAL_MS);
  } else {
    console.log('[SurgeOps] Simulator auto-start disabled (SIMULATOR_AUTO_START=false)');
  }

  // Auto-start pricing engine demand ingestion loop (polls every 15s)
  const pricingAutoStart = process.env.PRICING_AUTO_START !== 'false';
  if (pricingAutoStart) {
    startDemandIngestionLoop();
  } else {
    console.log('[SurgeOps] Pricing engine auto-start disabled (PRICING_AUTO_START=false)');
  }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = (signal: string) => {
  console.log(`\n[SurgeOps] Received ${signal}. Shutting down gracefully...`);

  stopDemandIngestionLoop();

  server.close(() => {
    console.log('[SurgeOps] HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));