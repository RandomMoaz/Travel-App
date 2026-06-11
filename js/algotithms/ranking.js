export function scoreHotel(hotel, budgetTier) {
  const targetPrice = budgetTier === "luxury" ? 400 : budgetTier === "low" ? 90 : 180;
  const priceFit = 1 - Math.min(1, Math.abs(hotel.pricePerNight - targetPrice) / targetPrice);
  const ratingScore = hotel.rating / 5;
  const reviewScore = Math.min(1, hotel.reviews / 300);
  return +(ratingScore * 0.5 + priceFit * 0.35 + reviewScore * 0.15).toFixed(3);
}

export function sortHotels(hotels, budgetTier = "medium") {
  return [...hotels]
    .map((h) => ({ ...h, score: scoreHotel(h, budgetTier) }))
    .sort((a, b) => b.score - a.score);
}

export function sortFlights(flights, by = "best") {
  const key = by === "price" ? (f) => f.price
    : by === "duration" ? (f) => f.durationMin
    : (f) => f.price * 0.6 + f.durationMin * 2 + f.stops * 300; // "best" blend
  return [...flights].sort((a, b) => key(a) - key(b));
}

/** Keep only activities whose category is in the chosen interests. */
export function filterActivities(activities, interests) {
  if (!interests?.length) return activities;
  const set = new Set(interests);
  return activities.filter((a) => set.has(a.category));
}

/**
 * Rank places by how well they fit interests + current weather.
 * Beach/nature get a boost in warm weather; museums/history in cold/rain.
 */
export function rankPlaces(places, { interests = [], weather } = {}) {
  const interestSet = new Set(interests);
  const temp = weather?.current?.temp ?? 20;
  const wet = /rain|drizzle|thunder|snow/i.test(weather?.current?.desc || "");

  return [...places]
    .map((p) => {
      let score = p.score ?? 7;
      if (interestSet.has(p.category)) score += 2;
      if (temp >= 22 && (p.category === "beach" || p.category === "nature")) score += 1;
      if ((temp < 14 || wet) && (p.category === "museums" || p.category === "history")) score += 1;
      return { ...p, score: +Math.min(10, score).toFixed(1) };
    })
    .sort((a, b) => b.score - a.score);
}
