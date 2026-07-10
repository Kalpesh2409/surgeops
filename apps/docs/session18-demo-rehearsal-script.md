# SurgeOps — Demo Rehearsal Script
**Session 18 — Spike Scenario Walkthrough**
**Store used:** Mumbai Bandra (store-mumbai-bandra, 18 products, 15 eligible for surge)
**Trigger:** POST /simulator/demo-ramp with stageDelayMs: 8000

This script is timed to real, verified numbers from this session's test run — not projections. If you re-run /demo-ramp before the interview, glance at the response to confirm the percentages still land in the same bands (they should, since the route self-verifies).

---

## Setup (before the interviewer is watching)

1. Confirm all three servers are running: API (port 4000), frontend (port 5173), ML service (port 8000).
2. Open the dashboard, select Bandra in the store selector.
3. Confirm the ZoneCard shows Normal / 0% — if not, run /demo-ramp once beforehand to reset.
4. Have a terminal window ready, sized so the interviewer can see it alongside the browser, with the /demo-ramp command pre-typed but not yet run.

---

## Stage 0 — Baseline (before triggering)

What's on screen: "0 of 18 products surging (0%)" — green Normal badge. All products at base price, 1.00x multiplier.

Say:
"This is Bandra at rest — no live demand pressure, every product priced at its baseline. Each product already has an ML-predicted baseline price running underneath, it's just that with zero live signal, the surge adjustment is neutral."

---

## Trigger the ramp

Run in terminal:

$body = @{ storeId = "store-mumbai-bandra"; stageDelayMs = 8000 } | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:4000/simulator/demo-ramp" -Method POST -Headers @{"Content-Type"="application/json"} -Body $body -UseBasicParsing | Select-Object -ExpandProperty Content

Say while it's running:
"This one call resets the store to a clean state, then ramps demand in two stages — first to an Elevated zone, then to full Surge — so you can watch the pricing engine react live."

---

## Stage 1 — Elevated (0-8 seconds after trigger)

What appears on screen: Badge flips to orange Elevated, reading "4 of 18 products surging (22%)". In the table: a mix of orange badges (~1.4x-1.5x, "Normal demand") and at least one red badge ("Heavy demand spike") even at this stage — most other products still unaffected at 1.00x.

Say:
"22% of products are now surging — we're in the Elevated band. Notice it's not uniform: some products spike harder than others because each one has its own pricing rule ceiling and its own ML-learned baseline. This isn't one global multiplier slapped on everything — it's per-product."

(Optional: hover over a product's info icon to show the Gemini-generated explanation tooltip.)

---

## Stage 2 — Surge (8+ seconds after trigger)

What appears on screen: Badge flips to red Surge, reading "10 of 18 products surging (56%)". Several products now show red "Heavy demand spike" badges; a few remain green with multipliers below 1.0x (e.g. 0.98x-1.05x).

Say:
"Now we've crossed into Surge — 56% of the store is under demand pressure, prices rising accordingly. But look here — this product's price actually went slightly down. That's low inventory pulling it the other way, independent of the surge signal. The system is reconciling multiple real-time signals per product, not just reacting to one input."

---

## Closing point

Say:
"Under the hood: this ramp calls the same /simulator/inject endpoint used for manual single-product tests, injecting real DemandEvent rows into Postgres, invalidating the Redis cache, recomputing price through the pricing engine — which blends an ML baseline with a live rules-based surge adjustment — and broadcasting the update over SSE so the dashboard updates without a page refresh. No polling, no page reload — this is fully event-driven."

---

## If something goes wrong live

- Percentages look off: re-run /demo-ramp — it self-corrects by re-checking real state after each injection.
- Dashboard doesn't update: check the LIVE indicator top-right — if it's not green, refresh the page.
- Ramp takes too long: lower stageDelayMs (e.g. to 4000) for a faster demo.

---

## Known, explainable boundaries (mention if asked)

- The RandomForest ML baseline only uses time-of-day/day-of-week features — it won't react to this live injection within its own prediction window. That's why the live surge adjustment layer exists separately.
- Gemini free-tier explanations are rate-limited (1 call/tick) — older explanations persist from the DB fallback if fired twice quickly.