/**
 * runMlPricingSuggestions.ts - SurgeOps Session 13
 *
 * Runs the ML-based pricing suggestion pipeline once and prints a summary.
 * Usage: cd apps/api && npx ts-node scripts/runMlPricingSuggestions.ts
 */

import { generateMlPricingSuggestions } from "../src/services/mlPricingSuggester";

async function main() {
  console.log("Starting ML pricing suggestion run...");
  const result = await generateMlPricingSuggestions();
  console.log("Done.");
  console.log(`Total inventory rows: ${result.total}`);
  console.log(`Suggestions written: ${result.written}`);
  console.log(`Errors: ${result.errors}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
