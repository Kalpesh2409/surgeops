// src/data/baselineStock.ts
//
// Single source of truth for "what stock/price should look like on Day 1"
// for every store × product combo. Used by:
//   1. prisma/seed/index.ts — the original DB seed
//   2. routes/simulator.ts — the /simulator/reset/:storeId safety endpoint
//
// If you ever change these numbers, change them ONLY here — both the seed
// script and the reset endpoint will pick up the change automatically.
//
// Session 27 (MRP correction pass): currentPrice values updated to match
// the corrected, realistic basePrice values now used in the seed script
// (Tata Salt, Fortune Oil, Lay's Chips, Parle-G, Kurkure, Amul Milk,
// Amul Butter, Maggi, Yippee Noodles, MTR Poha). Two entries remain
// intentionally pre-surged above their (unchanged) basePrice — Aashirvaad
// Atta in Pune (low stock) and Red Bull in Bangalore (low stock) — these
// demonstrate the "low inventory raises price" scenario out of the box.

export type StockEntry = {
  qty: number;
  reorderLevel: number;
  reorderQty: number;
  currentPrice: number;
};

export const stockMatrix: Record<string, Record<string, StockEntry>> = {
  'store-mumbai-bandra': {
    'prod-tata-salt':        { qty: 120, reorderLevel: 20, reorderQty: 100, currentPrice: 28.00  },
    'prod-fortune-oil':      { qty: 80,  reorderLevel: 15, reorderQty: 60,  currentPrice: 155.00 },
    'prod-aashirvaad-atta':  { qty: 60,  reorderLevel: 10, reorderQty: 50,  currentPrice: 285.00 },
    'prod-india-gate-rice':  { qty: 45,  reorderLevel: 10, reorderQty: 40,  currentPrice: 549.00 },
    'prod-lays-classic':     { qty: 200, reorderLevel: 50, reorderQty: 150, currentPrice: 10.00  },
    'prod-haldiram-bhujia':  { qty: 90,  reorderLevel: 20, reorderQty: 80,  currentPrice: 85.00  },
    'prod-parle-g':          { qty: 150, reorderLevel: 30, reorderQty: 120, currentPrice: 22.00  },
    'prod-kurkure-masala':   { qty: 110, reorderLevel: 25, reorderQty: 100, currentPrice: 20.00  },
    'prod-coca-cola-250':    { qty: 180, reorderLevel: 40, reorderQty: 150, currentPrice: 20.00  },
    'prod-tropicana-orange': { qty: 55,  reorderLevel: 10, reorderQty: 50,  currentPrice: 120.00 },
    'prod-bisleri-water':    { qty: 250, reorderLevel: 50, reorderQty: 200, currentPrice: 20.00  },
    'prod-redbull':          { qty: 40,  reorderLevel: 10, reorderQty: 40,  currentPrice: 125.00 },
    'prod-amul-milk':        { qty: 70,  reorderLevel: 20, reorderQty: 60,  currentPrice: 30.00  },
    'prod-amul-butter':      { qty: 50,  reorderLevel: 15, reorderQty: 50,  currentPrice: 62.00  },
    'prod-eggs-dozen':       { qty: 30,  reorderLevel: 10, reorderQty: 30,  currentPrice: 95.00  },
    'prod-maggi-masala':     { qty: 100, reorderLevel: 25, reorderQty: 80,  currentPrice: 112.00 },
    'prod-yippee-noodles':   { qty: 75,  reorderLevel: 20, reorderQty: 60,  currentPrice: 65.00  },
    'prod-mtr-poha':         { qty: 40,  reorderLevel: 10, reorderQty: 40,  currentPrice: 165.00 },
  },
  'store-pune-kothrud': {
    'prod-tata-salt':        { qty: 90,  reorderLevel: 15, reorderQty: 80,  currentPrice: 28.00  },
    'prod-fortune-oil':      { qty: 65,  reorderLevel: 12, reorderQty: 50,  currentPrice: 155.00 },
    'prod-aashirvaad-atta':  { qty: 5,   reorderLevel: 10, reorderQty: 50,  currentPrice: 299.00 }, // LOW STOCK → price up
    'prod-india-gate-rice':  { qty: 35,  reorderLevel: 8,  reorderQty: 35,  currentPrice: 549.00 },
    'prod-lays-classic':     { qty: 160, reorderLevel: 40, reorderQty: 120, currentPrice: 10.00  },
    'prod-haldiram-bhujia':  { qty: 0,   reorderLevel: 15, reorderQty: 80,  currentPrice: 85.00  }, // OUT OF STOCK
    'prod-parle-g':          { qty: 120, reorderLevel: 25, reorderQty: 100, currentPrice: 22.00  },
    'prod-kurkure-masala':   { qty: 85,  reorderLevel: 20, reorderQty: 80,  currentPrice: 20.00  },
    'prod-coca-cola-250':    { qty: 140, reorderLevel: 35, reorderQty: 120, currentPrice: 20.00  },
    'prod-tropicana-orange': { qty: 30,  reorderLevel: 8,  reorderQty: 40,  currentPrice: 120.00 },
    'prod-bisleri-water':    { qty: 200, reorderLevel: 45, reorderQty: 180, currentPrice: 20.00  },
    'prod-redbull':          { qty: 25,  reorderLevel: 8,  reorderQty: 30,  currentPrice: 125.00 },
    'prod-amul-milk':        { qty: 55,  reorderLevel: 15, reorderQty: 50,  currentPrice: 30.00  },
    'prod-amul-butter':      { qty: 40,  reorderLevel: 12, reorderQty: 40,  currentPrice: 62.00  },
    'prod-eggs-dozen':       { qty: 20,  reorderLevel: 8,  reorderQty: 25,  currentPrice: 95.00  },
    'prod-maggi-masala':     { qty: 80,  reorderLevel: 20, reorderQty: 70,  currentPrice: 112.00 },
    'prod-yippee-noodles':   { qty: 60,  reorderLevel: 15, reorderQty: 55,  currentPrice: 65.00  },
    'prod-mtr-poha':         { qty: 55,  reorderLevel: 12, reorderQty: 50,  currentPrice: 165.00 },
  },
  'store-bangalore-koramangala': {
    'prod-tata-salt':        { qty: 100, reorderLevel: 20, reorderQty: 90,  currentPrice: 28.00  },
    'prod-fortune-oil':      { qty: 70,  reorderLevel: 12, reorderQty: 55,  currentPrice: 155.00 },
    'prod-aashirvaad-atta':  { qty: 55,  reorderLevel: 10, reorderQty: 45,  currentPrice: 285.00 },
    'prod-india-gate-rice':  { qty: 40,  reorderLevel: 8,  reorderQty: 38,  currentPrice: 549.00 },
    'prod-lays-classic':     { qty: 220, reorderLevel: 50, reorderQty: 160, currentPrice: 10.00  },
    'prod-haldiram-bhujia':  { qty: 70,  reorderLevel: 18, reorderQty: 70,  currentPrice: 85.00  },
    'prod-parle-g':          { qty: 130, reorderLevel: 30, reorderQty: 110, currentPrice: 22.00  },
    'prod-kurkure-masala':   { qty: 95,  reorderLevel: 22, reorderQty: 90,  currentPrice: 20.00  },
    'prod-coca-cola-250':    { qty: 200, reorderLevel: 45, reorderQty: 160, currentPrice: 20.00  },
    'prod-tropicana-orange': { qty: 60,  reorderLevel: 12, reorderQty: 55,  currentPrice: 120.00 },
    'prod-bisleri-water':    { qty: 280, reorderLevel: 60, reorderQty: 220, currentPrice: 20.00  },
    'prod-redbull':          { qty: 8,   reorderLevel: 10, reorderQty: 35,  currentPrice: 137.00 }, // LOW STOCK → surge price
    'prod-amul-milk':        { qty: 80,  reorderLevel: 22, reorderQty: 65,  currentPrice: 30.00  },
    'prod-amul-butter':      { qty: 45,  reorderLevel: 12, reorderQty: 45,  currentPrice: 62.00  },
    'prod-eggs-dozen':       { qty: 35,  reorderLevel: 10, reorderQty: 32,  currentPrice: 95.00  },
    'prod-maggi-masala':     { qty: 110, reorderLevel: 25, reorderQty: 90,  currentPrice: 112.00 },
    'prod-yippee-noodles':   { qty: 80,  reorderLevel: 18, reorderQty: 70,  currentPrice: 65.00  },
    'prod-mtr-poha':         { qty: 65,  reorderLevel: 15, reorderQty: 60,  currentPrice: 165.00 },
  },
  'store-delhi-noida': {
    'prod-tata-salt':        { qty: 130, reorderLevel: 25, reorderQty: 110, currentPrice: 28.00  },
    'prod-fortune-oil':      { qty: 90,  reorderLevel: 18, reorderQty: 80,  currentPrice: 155.00 },
    'prod-aashirvaad-atta':  { qty: 70,  reorderLevel: 12, reorderQty: 60,  currentPrice: 285.00 },
    'prod-india-gate-rice':  { qty: 50,  reorderLevel: 10, reorderQty: 45,  currentPrice: 549.00 },
    'prod-lays-classic':     { qty: 240, reorderLevel: 55, reorderQty: 180, currentPrice: 10.00  },
    'prod-haldiram-bhujia':  { qty: 110, reorderLevel: 25, reorderQty: 100, currentPrice: 85.00  },
    'prod-parle-g':          { qty: 160, reorderLevel: 35, reorderQty: 140, currentPrice: 22.00  },
    'prod-kurkure-masala':   { qty: 120, reorderLevel: 28, reorderQty: 110, currentPrice: 20.00  },
    'prod-coca-cola-250':    { qty: 0,   reorderLevel: 45, reorderQty: 160, currentPrice: 20.00  }, // OUT OF STOCK
    'prod-tropicana-orange': { qty: 65,  reorderLevel: 12, reorderQty: 60,  currentPrice: 120.00 },
    'prod-bisleri-water':    { qty: 300, reorderLevel: 65, reorderQty: 250, currentPrice: 20.00  },
    'prod-redbull':          { qty: 45,  reorderLevel: 10, reorderQty: 40,  currentPrice: 125.00 },
    'prod-amul-milk':        { qty: 90,  reorderLevel: 25, reorderQty: 75,  currentPrice: 30.00  },
    'prod-amul-butter':      { qty: 60,  reorderLevel: 15, reorderQty: 55,  currentPrice: 62.00  },
    'prod-eggs-dozen':       { qty: 40,  reorderLevel: 12, reorderQty: 35,  currentPrice: 95.00  },
    'prod-maggi-masala':     { qty: 120, reorderLevel: 28, reorderQty: 100, currentPrice: 112.00 },
    'prod-yippee-noodles':   { qty: 90,  reorderLevel: 20, reorderQty: 80,  currentPrice: 65.00  },
    'prod-mtr-poha':         { qty: 30,  reorderLevel: 8,  reorderQty: 30,  currentPrice: 165.00 },
  },
};