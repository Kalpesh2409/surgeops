import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ZoneCard } from "../ZoneCard";
import type { PriceEntry } from "@/hooks/usePriceStream";

function makePrice(overrides: Partial<PriceEntry> = {}): PriceEntry {
  return {
    productId: "prod-1",
    productName: "Test Product",
    sku: "SKU-1",
    basePrice: 100,
    surgePrice: 100,
    surgeMultiplier: 1.0,
    confidence: 0.9,
    explanation: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ZoneCard", () => {
  it("renders Normal status when no products are surging", () => {
    const prices: Record<string, PriceEntry> = {
      "prod-1": makePrice({ surgeMultiplier: 1.0 }),
    };
    render(<ZoneCard prices={prices} />);
    expect(screen.getByText("Zone Demand Pressure")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
  });

  it("renders Surge status when majority of products are surging", () => {
    const prices: Record<string, PriceEntry> = {
      "prod-1": makePrice({ surgeMultiplier: 1.5 }),
      "prod-2": makePrice({ surgeMultiplier: 1.6 }),
    };
    render(<ZoneCard prices={prices} />);
    expect(screen.getByText("Surge")).toBeInTheDocument();
  });
});
