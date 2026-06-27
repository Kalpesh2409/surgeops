/**
 * app.ts
 * Express application setup.
 * Session 4 addition: /simulator routes
 */

import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';
import { storesRouter } from './routes/stores';
import simulatorRouter from './routes/simulator';

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/health', healthRouter);
app.use('/stores', storesRouter);
app.use('/simulator', simulatorRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;