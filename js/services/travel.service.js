const HOTEL_NAMES = ["Le Meurice", "The Grand Boutique", "Riverside Suites", "Old Town Inn", "Skyline Hotel", "Maison Centrale"];
const HOTEL_IMG = (i) => `https://picsum.photos/seed/hotel${i}/200/160`;

/** MOCK: hotels scaled to budget tier + requested rating. */
export async function getHotels({ destination, budget, preferences }) {
  await delay(220);
  const base = budget?.tier === "luxury" ? 320 : budget?.tier === "low" ? 70 : 150;
  return HOTEL_NAMES.map((name, i) => ({
    id: `h${i}`,
    name: `Hotel ${name}`,
    city: destination,
    rating: +(5 - i * 0.3).toFixed(1),
    stars: Math.min(5, Math.max(3, Math.round(5 - i * 0.4))),
    reviews: 80 + i * 37,
    pricePerNight: base + i * 35,
    image: HOTEL_IMG(i),
    amenities: ["wifi", i % 2 ? "pool" : "spa", "breakfast"],
  }));
}

const AIRLINES = ["Air France AF123", "Lufthansa LH440", "Emirates EK72", "Delta DL88"];


export async function getFlights({ destination, preferences }) {
  await delay(200);
  const cls = preferences?.flightClass || "economy";
  const mult = cls === "business" ? 3 : cls === "first" ? 5 : 1;
  return AIRLINES.map((label, i) => ({
    id: `f${i}`,
    airline: label,
    from: "JFK",
    to: "CDG",
    depart: `0${6 + i}:30`,
    arrive: `1${i}:45`,
    durationMin: 480 + i * 25,
    stops: i === 0 ? 0 : i % 2,
    class: cls,
    price: (650 + i * 90) * mult,
  }));
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
