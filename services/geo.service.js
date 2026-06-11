import { CONFIG } from "../config.js";
import { TTLCache } from "../structures/structures.js";
import { hashKey } from "../utils/utils.js";

const cache = new TTLCache(CONFIG.cacheTtlMs);

export async function geocode(query) {
  const q = (query || "").trim();
  if (q.length < 2) return [];
  const key = hashKey({ g: 1, q });
  if (cache.has(key)) return cache.get(key);

  const url = `${CONFIG.geo.search}?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding failed");
  const data = await res.json();

  const results = (data.results || []).map((r) => ({
    name: r.name,
    country: r.country,
    countryCode: r.country_code,
    admin: r.admin1 || "",
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
  }));
  return cache.set(key, results);
}

/** Resolve a single best match for a destination string. */
export async function resolveLocation(query) {
  const results = await geocode(query);
  if (!results.length) {
    // Open destinations like "Europe" may not geocode — return a soft fallback.
    return { name: query, country: "", lat: 48.8566, lon: 2.3522, timezone: "auto", label: query, approximate: true };
  }
  return results[0];
}

/** Static map thumbnail (OpenStreetMap static, keyless). */
export function staticMapUrl(lat, lon, zoom = 11, w = 400, h = 260) {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=${zoom}&size=${w}x${h}&markers=${lat},${lon},red-pushpin`;
}
export const osmLink = (lat, lon) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`;
