/**
 * simulator.ts (route)
 * Endpoints:
 *   GET  /simulator/status  — current simulator state + demand curve info
 *   POST /simulator/inject  — manual trigger (for Traffic Simulator buttons)
 *   POST /simulator/start   — start background loop
 *   POST /simulator/stop    — stop background loop
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  startSimulator,
  stopSimulator,
  getSimulatorStatus,
  manualInject,
} from '../services/orderSimulator';

const router = Router();

// ─── GET /simulator/status ────────────────────────────────────────────────────

router.get('/status', (_req: Request, res: Response) => {
  const status = getSimulatorStatus();
  res.json({
    success: true,
    data: status,
  });
});

// ─── POST /simulator/start ────────────────────────────────────────────────────

router.post('/start', (req: Request, res: Response) => {
  const intervalMs = req.body?.intervalMs as number | undefined;

  if (intervalMs !== undefined && (typeof intervalMs !== 'number' || intervalMs < 5_000)) {
    res.status(400).json({
      success: false,
      error: 'intervalMs must be a number >= 5000',
    });
    return;
  }

  startSimulator(intervalMs);

  res.json({
    success: true,
    message: 'Simulator started',
    data: getSimulatorStatus(),
  });
});

// ─── POST /simulator/stop ─────────────────────────────────────────────────────

router.post('/stop', (_req: Request, res: Response) => {
  stopSimulator();
  res.json({
    success: true,
    message: 'Simulator stopped',
    data: getSimulatorStatus(),
  });
});

// ─── POST /simulator/inject ───────────────────────────────────────────────────
/**
 * Manual trigger for the Traffic Simulator buttons on the dashboard.
 *
 * Body (all optional):
 *   storeId        — target a specific store (omit for all stores)
 *   surgeMultiplier — override demand level (0.0–2.0); default = current IST hour
 *   orderCount     — exact orders to generate per store; default = formula-based
 *
 * Presets the frontend can call:
 *   { surgeMultiplier: 0.1 }  → quiet mode
 *   { surgeMultiplier: 0.8 }  → normal traffic
 *   { surgeMultiplier: 1.5 }  → evening surge
 *   { surgeMultiplier: 2.0 }  → flash sale / storm surge
 */
router.post('/inject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId, surgeMultiplier, orderCount } = req.body ?? {};

    // Validation
    if (storeId !== undefined && typeof storeId !== 'string') {
      res.status(400).json({ success: false, error: 'storeId must be a string' });
      return;
    }
    if (surgeMultiplier !== undefined) {
      if (typeof surgeMultiplier !== 'number' || surgeMultiplier < 0 || surgeMultiplier > 5) {
        res.status(400).json({
          success: false,
          error: 'surgeMultiplier must be a number between 0 and 5',
        });
        return;
      }
    }
    if (orderCount !== undefined) {
      if (!Number.isInteger(orderCount) || orderCount < 1 || orderCount > 50) {
        res.status(400).json({
          success: false,
          error: 'orderCount must be an integer between 1 and 50',
        });
        return;
      }
    }

    const result = await manualInject({ storeId, surgeMultiplier, orderCount });

    res.json({
      success: true,
      message: `Injected ${result.ordersCreated} orders across ${result.storeResults.length} store(s)`,
      data: {
        ordersCreated: result.ordersCreated,
        demandEventsWritten: result.demandEventsWritten,
        storeBreakdown: result.storeResults.map((r) => ({
          storeId: r.storeId,
          ordersCreated: r.ordersCreated,
          demandEventsWritten: r.demandEventsWritten,
          skipped: r.skipped,
          reason: r.reason,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;