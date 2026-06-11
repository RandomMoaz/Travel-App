import { CONFIG } from "../config.js";
import { TTLCache } from "../structures/structures.js";
import { hashKey } from "../utils/utils.js";

const cache = new TTLCache(CONFIG.cacheTtlMs);

const WMO = {
  0: ["Clear", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Foggy", "🌫️"], 48: ["Rime fog", "🌫️"], 51: ["Light drizzle", "🌦️"], 61: ["Rain", "🌧️"],
  63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"], 71: ["Snow", "🌨️"], 80: ["Showers", "🌦️"],
  95: ["Thunderstorm", "⛈️"],
};
const describe = (code) => WMO[code] || ["Mild", "🌤️"];

export async function getWeather({ lat, lon, from }) {
  const key = hashKey({ w: 1, lat, lon, from });
  if (cache.has(key)) return cache.get(key);

  const url = `${CONFIG.weather.forecast}?latitude=${lat}&longitude=${lon}`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min`
    + `&current=temperature_2m,weather_code&timezone=auto&forecast_days=7`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather API failed");
  const data = await res.json();

  const [curDesc, curIcon] = describe(data.current?.weather_code);
  const daily = (data.daily?.time || []).map((date, i) => {
    const [d, icon] = describe(data.daily.weather_code[i]);
    return {
      date,
      day: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
      desc: d, icon,
      max: Math.round(data.daily.temperature_2m_max[i]),
      min: Math.round(data.daily.temperature_2m_min[i]),
    };
  });

  const normalized = {
    current: { temp: Math.round(data.current?.temperature_2m ?? daily[0]?.max ?? 20), desc: curDesc, icon: curIcon },
    daily,
  };
  return cache.set(key, normalized);
}
