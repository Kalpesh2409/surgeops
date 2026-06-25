import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();
const PORT = process.env.PORT ?? 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "surgeops-api",
    timestamp: new Date().toISOString(),
  });
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 SurgeOps API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});

export default app;