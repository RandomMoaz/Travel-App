import { CONFIG } from "../config.js";
import { MockAiStrategy, OpenAiStrategy, GeminiStrategy } from "../strategies/ai.strategy.js";
import { buildAiPrompt } from "../models/trip.model.js";
import { TTLCache, RetryQueue } from "../structures/structures.js";
import { hashKey } from "../utils/utils.js";

const cache = new TTLCache(CONFIG.cacheTtlMs);
const queue = new RetryQueue(CONFIG.maxRetries);

/** FACTORY: pick an AI strategy by config (falls back to mock). */
export function makeAiStrategy(which = CONFIG.aiStrategy) {
  switch (which) {
    case "openai":
      if (CONFIG.ai.openai.apiKey) return new OpenAiStrategy(CONFIG.ai.openai);
      console.warn("[ai] no OpenAI key — using mock.");
      return new MockAiStrategy();
    case "gemini":
      if (CONFIG.ai.gemini.apiKey) return new GeminiStrategy(CONFIG.ai.gemini);
      console.warn("[ai] no Gemini key — using mock.");
      return new MockAiStrategy();
    default:
      return new MockAiStrategy();
  }
}

/** Generate the AI plan with caching + retry-queue resilience. */
export async function generatePlan(trip) {
  const { payload, prompt } = buildAiPrompt(trip);
  const key = hashKey({ ai: 1, payload });
  if (cache.has(key)) return cache.get(key);

  const strategy = makeAiStrategy();
  const result = await queue.enqueue(() => strategy.generate({ payload, prompt }), "ai.generate");
  validatePlan(result);
  return cache.set(key, result);
}

/** Defensive validation that the AI returned the agreed schema. */
function validatePlan(p) {
  const required = ["summary", "dailyPlan", "budget", "packingList", "warnings", "bestPlaces"];
  const missing = required.filter((k) => !(k in p));
  if (missing.length) throw new Error("AI plan missing fields: " + missing.join(", "));
  return true;
}