import { daysBetween } from "../utils/utils.js";

function extractJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI returned no JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/* ============================================================
   MOCK STRATEGY — deterministic, offline, schema-correct
   ============================================================ */
export class MockAiStrategy {
  name = "mock";

  async generate({ payload }) {
    await new Promise((r) => setTimeout(r, 900)); // simulate latency
    const days = daysBetween(payload.dates.from, payload.dates.to);
    const place = payload.location?.name || payload.destination;
    const country = payload.location?.country || "";
    const interests = payload.interests?.length ? payload.interests : ["food", "culture"];

    const POOL = {
      food: { t: "Local food tour", d: "Taste signature dishes and street eats.", img: "food" },
      museums: { t: "Museum visit", d: "Explore world-famous art and history.", img: "museum" },
      adventure: { t: "Outdoor adventure", d: "Hiking, cycling or a thrill activity.", img: "adventure" },
      nature: { t: "Nature escape", d: "Parks, gardens and scenic viewpoints.", img: "nature" },
      beach: { t: "Beach time", d: "Relax by the water and swim.", img: "beach" },
      shopping: { t: "Shopping district", d: "Browse markets and boutiques.", img: "shopping" },
      history: { t: "Historic landmarks", d: "Visit iconic monuments and old quarters.", img: "history" },
      nightlife: { t: "Evening out", d: "Live music, bars and city lights.", img: "nightlife" },
      "family-friendly": { t: "Family activity", d: "Fun for all ages.", img: "family" },
    };

    const dailyPlan = Array.from({ length: days }, (_, i) => {
      const dayDate = new Date(payload.dates.from);
      dayDate.setDate(dayDate.getDate() + i);
      // Rotate starting interest each day so activities vary across the trip
      const offset = i % interests.length;
      const rotated = [...interests.slice(offset), ...interests.slice(0, offset)];
      const picks = rotated.slice(0, 4);
      const times = ["09:00 AM", "12:30 PM", "03:00 PM", "07:00 PM"];
      const activities = picks.map((k, idx) => {
        const a = POOL[k] || { t: "Explore the city", d: "Discover hidden gems.", img: "city" };
        return {
          time: times[idx],
          title: i === 0 && idx === 0 ? `Arrive & ${a.t.toLowerCase()}` : a.t,
          description: a.d,
          category: k,
          image: `https://picsum.photos/seed/${a.img}${i}${idx}/120/96`,
        };
      });
      return {
        day: i + 1,
        date: dayDate.toISOString().slice(0, 10),
        label: dayDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        activities,
      };
    });

    const total = payload.budget?.amount || 2500;
    const budget = {
      total, currency: "$",
      breakdown: [
        { label: "Flights", amount: Math.round(total * 0.37) },
        { label: "Hotels", amount: Math.round(total * 0.43) },
        { label: "Food", amount: Math.round(total * 0.12) },
        { label: "Activities", amount: Math.round(total * 0.06) },
        { label: "Transport", amount: Math.round(total * 0.02) },
      ],
    };

    const warm = payload.weather?.current?.temp;
    const warnings = [
      "Keep digital and printed copies of your passport and bookings.",
      warm != null && warm < 12 ? "Pack warm layers — temperatures may be cool." : "Stay hydrated and use sun protection.",
      payload.travelers?.children ? "Some venues may need advance booking for children." : "Book popular attractions ahead to skip queues.",
    ];

    const packingList = [
      "Passport & travel docs", "Comfortable walking shoes", "Phone charger & adapter",
      "Weather-appropriate clothing", "Reusable water bottle", "Basic medication",
      payload.preferences?.weather === "warm" ? "Sunglasses & sunscreen" : "Light jacket",
    ];

    const bestPlaces = (interests.length ? interests : ["history", "food"]).slice(0, 5).map((k, i) => ({
      name: `${(POOL[k]?.t || "Highlight")} in ${place}`,
      category: k,
      score: +(9.4 - i * 0.4).toFixed(1),
      description: POOL[k]?.d || "A must-see local highlight.",
      image: `https://picsum.photos/seed/place${k}${i}/200/160`,
    }));

    return {
      summary: `Enjoy a ${days}-day trip to ${place}${country ? ", " + country : ""}! This itinerary balances `
        + `${interests.slice(0, 3).join(", ")} with relaxation, tuned to a ${payload.budget?.tier} budget for `
        + `${payload.travelers?.total} traveler(s).`,
      dailyPlan, budget, packingList, warnings, bestPlaces,
    };
  }
}

/* ============================================================
   OPENAI STRATEGY — real provider (needs key in config)
   ============================================================ */
export class OpenAiStrategy {
  name = "openai";
  constructor(cfg) { this.cfg = cfg; }

  async generate({ prompt }) {
    const res = await fetch(this.cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({
        model: this.cfg.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a travel planner. Reply with valid JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    return extractJson(data.choices?.[0]?.message?.content || "");
  }
}

/* ============================================================
   GEMINI STRATEGY — real provider (needs key in config)
   ============================================================ */
export class GeminiStrategy {
  name = "gemini";
  constructor(cfg) { this.cfg = cfg; }

  async generate({ prompt }) {
    const res = await fetch(`${this.cfg.endpoint}?key=${this.cfg.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt + "\nReturn ONLY raw JSON." }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}`);
    const data = await res.json();
    return extractJson(data.candidates?.[0]?.content?.parts?.[0]?.text || "");
  }
}
