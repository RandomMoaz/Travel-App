import { totalTravelers } from "../utils/validators.js";

export class Trip {
  constructor(data) {
    this.id = data.id || `trip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.destination = data.destination;
    this.dates = data.dates;                 // { from, to }
    this.travelers = data.travelers;         // { adults, children, total }
    this.budget = data.budget;               // { tier, amount }
    this.interests = data.interests || [];   // string[]
    this.preferences = data.preferences || {};
    this.notes = data.notes || "";
    // Enriched later by services:
    this.weather = data.weather || null;
    this.location = data.location || null;
    this.hotels = data.hotels || [];
    this.flights = data.flights || [];
    this.plan = data.plan || null;           // AI result
  }
}

export function createTrip(form) {
  const tierAmount = { low: 800, medium: 2500, luxury: 6000 };
  const amount = form.budget === "custom" ? Number(form.customBudget) : tierAmount[form.budget] ?? 2500;

  return new Trip({
    destination: form.destination.trim(),
    dates: { from: form.startDate, to: form.endDate },
    travelers: {
      adults: Number(form.adults),
      children: Number(form.children),
      total: totalTravelers(form),
    },
    budget: { tier: form.budget, amount },
    interests: form.interests,
    preferences: {
      hotelRating: form.hotelRating,
      flightClass: form.flightClass,
      weather: form.weatherPref,
      pace: form.pace,
    },
    notes: form.notes,
  });
}


export function buildAiPrompt(trip) {
  const payload = {
    destination: trip.destination,
    dates: trip.dates,
    travelers: trip.travelers,
    budget: trip.budget,
    interests: trip.interests,
    preferences: trip.preferences,
    weather: trip.weather,
    location: trip.location,
    hotels: trip.hotels,
    flights: trip.flights,
    notes: trip.notes,
  };
  const prompt =
`Create a travel plan based on this JSON:
${JSON.stringify(payload, null, 2)}
Return valid JSON with: summary, dailyPlan, budget, packingList, warnings, bestPlaces.`;
  return { payload, prompt };
}
