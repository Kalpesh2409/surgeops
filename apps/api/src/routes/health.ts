import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  try {
    // Lightweight DB ping — just count stores
    const storeCount = await prisma.store.count();

    res.json({
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      stores_seeded: storeCount,
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      status: 'degraded',
      timestamp: new Date().toISOString(),
      database: 'unreachable',
      error: (err as Error).message,
    });
  }
});