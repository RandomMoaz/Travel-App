import { test, eq, ok, report } from "./harness.js";
import { validateTrip, totalTravelers } from "../js/utils/validators.js";
import { sortHotels, sortFlights, filterActivities, rankPlaces, scoreHotel } from "../js/algorithms/ranking.js";
import { getHotels, getFlights } from "../js/services/travel.service.js";
import { MockAiStrategy } from "../js/strategies/ai.strategy.js";
import { createTrip, buildAiPrompt } from "../js/models/trip.model.js";
import { TTLCache, RetryQueue, uniqueBy } from "../js/structures/structures.js";

const future = (d) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };

/* ---------- Validators ---------- */
test("validator: rejects end date before start date", () => {
  const { valid, errors } = validateTrip({ destination: "Paris", startDate: future(10), endDate: future(5), adults: 2, children: 0, budget: "medium" });
  ok(!valid); ok(errors.endDate);
});
test("validator: accepts a well-formed trip", () => {
  const { valid } = validateTrip({ destination: "Paris", startDate: future(5), endDate: future(10), adults: 2, children: 1, budget: "medium", interests: ["food"] });
  ok(valid);
});
test("validator: requires custom amount when budget is custom", () => {
  const { valid, errors } = validateTrip({ destination: "Rome", startDate: future(5), endDate: future(8), adults: 1, children: 0, budget: "custom", customBudget: "" });
  ok(!valid); ok(errors.customBudget);
});
test("validator: totalTravelers sums adults + children", () => { eq(totalTravelers({ adults: 2, children: 3 }), 5); });

/* ---------- Ranking ---------- */
test("ranking: hotels sorted by descending score", async () => {
  const hotels = await getHotels({ destination: "Paris", budget: { tier: "medium" }, preferences: {} });
  const sorted = sortHotels(hotels, "medium");
  for (let i = 1; i < sorted.length; i++) ok(sorted[i - 1].score >= sorted[i].score, "not descending");
});
test("ranking: scoreHotel returns 0..1", () => {
  const s = scoreHotel({ pricePerNight: 180, rating: 4.5, reviews: 200 }, "medium");
  ok(s >= 0 && s <= 1);
});
test("ranking: cheapest flight first when sorting by price", async () => {
  const flights = await getFlights({ destination: "Paris", preferences: { flightClass: "economy" } });
  const sorted = sortFlights(flights, "price");
  for (let i = 1; i < sorted.length; i++) ok(sorted[i - 1].price <= sorted[i].price);
});
test("ranking: filterActivities keeps only matching interests", () => {
  const acts = [{ category: "food" }, { category: "beach" }, { category: "museums" }];
  eq(filterActivities(acts, ["food", "museums"]).length, 2);
});
test("ranking: rankPlaces boosts beaches in warm weather", () => {
  const places = [{ name: "Beach", category: "beach", score: 7 }, { name: "Museum", category: "museums", score: 7 }];
  const ranked = rankPlaces(places, { interests: [], weather: { current: { temp: 28, desc: "Clear" } } });
  eq(ranked[0].category, "beach");
});

/* ---------- Mock adapters return correct shapes ---------- */
test("adapter: getHotels returns priced, rated hotels", async () => {
  const hotels = await getHotels({ destination: "Paris", budget: { tier: "luxury" }, preferences: {} });
  ok(hotels.length > 0); ok(hotels[0].pricePerNight > 0); ok("rating" in hotels[0]);
});
test("adapter: business class multiplies flight price", async () => {
  const eco = await getFlights({ destination: "Paris", preferences: { flightClass: "economy" } });
  const biz = await getFlights({ destination: "Paris", preferences: { flightClass: "business" } });
  ok(biz[0].price > eco[0].price);
});

/* ----------  AI strategy ---------- */
test("model: createTrip normalizes form into Trip", () => {
  const trip = createTrip({ destination: " Paris ", startDate: future(5), endDate: future(10), adults: "2", children: "1", budget: "medium", interests: ["food"] });
  eq(trip.destination, "Paris"); eq(trip.travelers.total, 3); ok(trip.budget.amount > 0);
});
test("prompt: buildAiPrompt asks for the required JSON keys", () => {
  const trip = createTrip({ destination: "Paris", startDate: future(5), endDate: future(8), adults: "2", children: "0", budget: "low", interests: [] });
  const { prompt } = buildAiPrompt(trip);
  ["summary", "dailyPlan", "budget", "packingList", "warnings", "bestPlaces"].forEach((k) => ok(prompt.includes(k), "missing " + k));
});
test("ai(mock): returns the full schema with one day per date", async () => {
  const trip = createTrip({ destination: "Paris", startDate: future(5), endDate: future(7), adults: "2", children: "0", budget: "medium", interests: ["food", "nature"] });
  const { payload } = buildAiPrompt(trip);
  const plan = await new MockAiStrategy().generate({ payload });
  ["summary", "dailyPlan", "budget", "packingList", "warnings", "bestPlaces"].forEach((k) => ok(k in plan));
  eq(plan.dailyPlan.length, 3); // 3-day inclusive range
  ok(plan.budget.breakdown.length > 0);
});

/* ---------- TTLCache ---------- */
test("TTLCache: returns value before expiry", () => {
  const cache = new TTLCache(5000);
  cache.set("k", "v");
  eq(cache.get("k"), "v");
});
test("TTLCache: returns undefined after TTL expires", async () => {
  const cache = new TTLCache(10); // 10ms TTL
  cache.set("x", 42);
  await new Promise((r) => setTimeout(r, 20));
  eq(cache.get("x"), undefined);
});
test("TTLCache: has() returns false for expired key", async () => {
  const cache = new TTLCache(10);
  cache.set("y", "hello");
  await new Promise((r) => setTimeout(r, 20));
  ok(!cache.has("y"));
});
test("TTLCache: set() returns the stored value", () => {
  const cache = new TTLCache(5000);
  eq(cache.set("k", 99), 99);
});

/* ---------- RetryQueue ---------- */
test("RetryQueue: resolves immediately on success", async () => {
  const q = new RetryQueue(2);
  const result = await q.enqueue(() => Promise.resolve("done"));
  eq(result, "done");
});
test("RetryQueue: retries a failing task and eventually resolves", async () => {
  const q = new RetryQueue(2);
  let attempts = 0;
  const result = await q.enqueue(() => {
    attempts++;
    if (attempts < 2) return Promise.reject(new Error("fail"));
    return Promise.resolve("ok");
  });
  eq(result, "ok");
  eq(attempts, 2);
});
test("RetryQueue: rejects after max retries are exhausted", async () => {
  const q = new RetryQueue(1);
  let caught = false;
  await q.enqueue(() => Promise.reject(new Error("always fails"))).catch(() => { caught = true; });
  ok(caught);
});

/* ---------- uniqueBy ---------- */
test("uniqueBy: removes duplicates by key", () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 1 }];
  eq(uniqueBy(items, (i) => i.id).length, 2);
});
test("uniqueBy: preserves first occurrence of each key", () => {
  const items = [{ id: 1, v: "a" }, { id: 1, v: "b" }];
  eq(uniqueBy(items, (i) => i.id)[0].v, "a");
});
test("uniqueBy: returns all items when all keys are unique", () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  eq(uniqueBy(items, (i) => i.id).length, 3);
});

await report();
