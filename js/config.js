export const CONFIG = {
  // Which AI strategy to use: "mock" | "openai" | "gemini"
  aiStrategy: "mock",

  ai: {

    openai: { endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini", apiKey: "YOUR_KEY_HERE" },
    gemini: { endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", apiKey: "YOUR_KEY_HERE" },
  },

  weather: { geocode: "https://geocoding-api.open-meteo.com/v1/search", forecast: "https://api.open-meteo.com/v1/forecast" },
  geo: { search: "https://geocoding-api.open-meteo.com/v1/search" },

  
  flightStrategy: "mock",
  hotelStrategy: "mock",


  cacheTtlMs: 1000 * 60 * 30, // 30 min response cache
  debounceMs: 350,
  maxRetries: 2,
};
