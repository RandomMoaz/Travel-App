import { el, $ } from "../utils/utils.js";
import { tripStore } from "../store/trip.store.js";
import { router } from "../router/router.js";
import { resolveLocation } from "../services/geo.service.js";
import { getWeather } from "../services/weather.service.js";
import { getHotels, getFlights } from "../services/travel.service.js";
import { generatePlan } from "../services/ai.service.js";
import { sortHotels, sortFlights } from "../algorithms/ranking.js";

const TASKS = [
  { id: "location", title: "Getting location details", sub: "Map, coordinates & local info", icon: "📍" },
  { id: "weather", title: "Fetching weather data", sub: "Real-time forecast for your dates", icon: "🌦️" },
  { id: "flights", title: "Finding best flights", sub: "Searching for available flights", icon: "✈️" },
  { id: "hotels", title: "Finding top hotels", sub: "Best stays for your budget", icon: "🏨" },
  { id: "ai", title: "Asking AI to craft your plan", sub: "This may take a few seconds…", icon: "✨" },
];

export function GenerateView() {
  const trip = tripStore.getState().trip;
  if (!trip) { router.navigate("/"); return el("div"); }

  const taskEls = {};
  const list = el("div", { class: "task-list" });
  TASKS.forEach((t) => {
    const status = el("div", { class: "task__status task__status--queued", html: statusHtml("queued") });
    const node = el("div", { class: "task", dataset: { id: t.id } }, [
      el("div", { class: "task__icon", text: t.icon }),
      el("div", { class: "task__body" }, [
        el("div", { class: "task__title", text: t.title }),
        el("div", { class: "task__sub", text: t.sub }),
      ]),
      status,
    ]);
    taskEls[t.id] = { node, status };
    list.appendChild(node);
  });

  const root = el("div", { class: "view container", style: "max-width:680px" }, [
    el("div", { class: "generate-head" }, [
      el("h1", { text: "Creating your perfect trip…" }),
      el("p", { class: "muted", text: "Please wait while we gather information and our AI builds your personalized plan." }),
    ]),
    list,
    el("div", { class: "hero-illustration", html: travelSvg() }),
    el("div", { class: "tip-banner", html: "<b>Tip:</b> AI is creating a personalized plan based on your preferences, budget, and real-time data." }),
  ]);

  const setStatus = (id, state) => {
    const t = taskEls[id]; if (!t) return;
    t.node.classList.toggle("is-active", state === "active");
    t.node.classList.toggle("is-done", state === "done");
    t.status.className = `task__status task__status--${state === "done" ? "done" : state === "active" ? "active" : "queued"}`;
    t.status.innerHTML = statusHtml(state);
  };

  // Kick off the async pipeline after paint.
  setTimeout(() => runPipeline(trip, setStatus), 60);
  return root;
}

async function runPipeline(trip, setStatus) {
  try {
    // 1) Location first (weather depends on coordinates).
    setStatus("location", "active");
    const loc = trip.location?.lat ? trip.location : await resolveLocation(trip.destination);
    trip.location = loc;
    setStatus("location", "done");

    // 2) Independent calls in PARALLEL (Promise.all).
    setStatus("weather", "active"); setStatus("flights", "active"); setStatus("hotels", "active");
    const [weather, flights, hotels] = await Promise.all([
      getWeather({ lat: loc.lat, lon: loc.lon, from: trip.dates.from }).catch(() => null),
      getFlights({ destination: trip.destination, preferences: trip.preferences }),
      getHotels({ destination: trip.destination, budget: trip.budget, preferences: trip.preferences }),
    ]);
    trip.weather = weather;
    trip.flights = sortFlights(flights, "best");
    trip.hotels = sortHotels(hotels, trip.budget.tier);
    setStatus("weather", "done"); setStatus("flights", "done"); setStatus("hotels", "done");

    // 3) AI plan (depends on everything above).
    setStatus("ai", "active");
    trip.plan = await generatePlan(trip);
    setStatus("ai", "done");

    tripStore.setState({ trip, status: "ready" });
    setTimeout(() => router.navigate("/results"), 450);
  } catch (err) {
    console.error(err);
    tripStore.setState({ status: "error", error: err.message });
    router.navigate("/results");
  }
}

function statusHtml(state) {
  if (state === "done") return "Completed&nbsp;✓";
  if (state === "active") return `<span class="spinner"></span> In Progress`;
  return "Queued";
}

function travelSvg() {
  return `<svg width="220" height="120" viewBox="0 0 220 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="110" cy="108" rx="92" ry="8" fill="#dbeafe"/>
    <path d="M40 80 L70 50 L100 80 Z" fill="#bfdbfe"/>
    <rect x="96" y="40" width="22" height="40" rx="3" fill="#2563eb"/>
    <rect x="124" y="55" width="16" height="25" rx="2" fill="#60a5fa"/>
    <path d="M150 30 l40 14 -40 14 8 -14 z" fill="#2563eb"/>
    <circle cx="60" cy="28" r="9" fill="#bae6fd"/><circle cx="172" cy="22" r="6" fill="#bae6fd"/>
  </svg>`;
}
