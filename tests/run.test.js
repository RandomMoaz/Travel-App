import { test, eq, ok, report } from "./harness.js";
import { validateTrip, totalTravelers } from "../js/utils/validators.js";
import { sortHotels, sortFlights, filterActivities, rankPlaces, scoreHotel } from "../js/algorithms/ranking.js";
import { getHotels, getFlights } from "../js/services/travel.service.js";
import { MockAiStrategy } from "../js/strategies/ai.strategy.js";
import { createTrip, buildAiPrompt } from "../js/models/trip.model.js";

const future = (d) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };

/* ---------- Validators ---------- */
test("validator: rejects end date before start date", () => {
  const { valid, errors } = validateTrip({ destination: "Paris", startDate: future(10), endDate: future(5), adults: 2, children: 0, budget: "medium" });
  ok(!valid); ok(errors.endDate);
});
test("validator: accepts a well-formed trip", () => {
  const { valid } = validateTrip({ destination: "Paris", startDate: future(5), endDate: future(10), adults: 2, children: 1, budget: "medium" });
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

await report();
