import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn(
    "[geminiExplainer] GEMINI_API_KEY is not set — explanations will be skipped.",
  );
} else {
  console.log(
    `[geminiExplainer] Key loaded, starts with: ${apiKey.slice(0, 8)}...`,
  );
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

interface PricingContext {
  productName: string;
  storeName: string;
  basePrice: number;
  currentPrice: number;
  surgeMultiplier: number;
  confidence: number;
}

export async function generatePriceExplanation(
  ctx: PricingContext,
): Promise<string | null> {
  if (!genAI) return null;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are explaining a dynamic pricing decision to a quick-commerce store manager in India, in one short plain-English sentence (max 25 words). No jargon like "ML baseline", "surge multiplier", or "confidence score" — describe it the way you'd explain it to a non-technical person.

Product: ${ctx.productName}
Store: ${ctx.storeName}
Base price: ₹${ctx.basePrice.toFixed(2)}
Current price: ₹${ctx.currentPrice.toFixed(2)}
Price change factor: ${ctx.surgeMultiplier.toFixed(2)}x normal
Model confidence: ${(ctx.confidence * 100).toFixed(0)}%

Respond with ONLY the one-sentence explanation, nothing else.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return text;
  } catch (err) {
    console.error("[geminiExplainer] Failed to generate explanation:", err);
    return null;
  }
}
