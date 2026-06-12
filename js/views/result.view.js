import { el, $, money, fmtRange, toast } from "../utils/utils.js";
import { tripStore } from "../store/trip.store.js";
import { router } from "../router/router.js";
import { tripStorage } from "../utils/storage.js";
import { staticMapUrl, osmLink } from "../services/geo.service.js";
import { rankPlaces, filterActivities } from "../algorithms/ranking.js";

const TABS = ["Itinerary", "Top Places", "Hotels", "Flights", "Budget", "Packing List", "Warnings"];

export function ResultsView() {
  const { trip, status, error } = tripStore.getState();

  if (status === "error" || !trip?.plan) {
    return el("div", { class: "view container" }, [
      el("div", { class: "card card--pad state" }, [
        el("div", { class: "state__icon", text: "⚠️" }),
        el("h2", { text: "Something went wrong" }),
        el("p", { class: "muted", text: error || "We couldn't build your plan. Please try again." }),
        el("button", { class: "btn btn--primary", text: "Back to planning", style: "margin-top:16px", onClick: () => router.navigate("/") }),
      ]),
    ]);
  }

  const plan = trip.plan;
  const cur = plan.budget?.currency || "$";

  const header = el("div", { class: "results-head" }, [
    el("div", {}, [
      el("h1", { text: `Your Trip to ${trip.location?.name || trip.destination}` }),
      el("div", { class: "results-head__meta", text:
        `${fmtRange(trip.dates.from, trip.dates.to)} · ${trip.travelers.total} Travelers · Budget: ${cap(trip.budget.tier)}` }),
    ]),
    el("div", { class: "results-head__actions" }, [
      el("button", { class: "btn btn--secondary", html: "♡ Save Trip", onClick: saveTrip }),
      el("button", { class: "btn btn--secondary", html: "↗ Share", onClick: shareTrip }),
    ]),
  ]);

  async function saveTrip() {
    await tripStorage.saveTrip(JSON.parse(JSON.stringify(trip)));
    const all = await tripStorage.allTrips();
    tripStore.setState({ savedTrips: all });
    toast("Trip saved offline ✓", "ok");
  }
  function shareTrip() {
    const text = `My trip to ${trip.destination}: ${plan.summary}`;
    if (navigator.share) navigator.share({ title: "JourneyAI", text }).catch(() => {});
    else { navigator.clipboard?.writeText(text); toast("Summary copied to clipboard", "ok"); }
  }

  // Weather banner
  const weatherBanner = trip.weather ? buildWeather(trip) : null;

  // AI summary + map
  const summary = el("div", { class: "card card--pad summary-card", style: "margin:18px 0" }, [
    el("div", { class: "summary-card__icon", text: "✨" }),
    el("div", { class: "summary-card__text" }, [
      el("h3", { text: "AI Trip Summary", style: "margin-bottom:6px" }),
      el("p", { class: "muted", text: plan.summary }),
    ]),
    trip.location?.lat ? el("div", { class: "map-thumb" }, [
      el("img", { src: staticMapUrl(trip.location.lat, trip.location.lon), alt: "Map", loading: "lazy",
        onerror: function () { this.style.display = "none"; } }),
      el("a", { class: "btn btn--secondary", style: "padding:6px 12px;font-size:12px", href: osmLink(trip.location.lat, trip.location.lon), target: "_blank", text: "View on Map" }),
    ]) : null,
  ]);

  // Tabs + lazy panels
  const tabBar = el("div", { class: "tabs" });
  const panelHost = el("div", {});
  const rendered = {};
  const showTab = (name) => {
    [...tabBar.children].forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
    panelHost.innerHTML = "";
    if (!rendered[name]) rendered[name] = renderPanel(name, trip); // lazy build once
    panelHost.appendChild(rendered[name]);
  };
  TABS.forEach((name, i) => {
    const btn = el("button", { class: "tab" + (i === 0 ? " is-active" : ""), text: name, dataset: { tab: name } });
    btn.addEventListener("click", () => showTab(name));
    tabBar.appendChild(btn);
  });

  const left = el("div", {}, [tabBar, el("div", { class: "panel" }, [panelHost])]);
  const right = buildSidebar(trip);

  const root = el("div", { class: "view container" }, [
    header,
    weatherBanner,
    summary,
    el("div", { class: "results-grid" }, [left, right]),
  ]);

  setTimeout(() => showTab("Itinerary"), 0);
  return root;
}

/* ---------- Panels (built lazily) ---------- */
function renderPanel(name, trip) {
  const plan = trip.plan;
  switch (name) {
    case "Itinerary": return itineraryPanel(plan, trip.interests);
    case "Top Places": return placesPanel(trip);
    case "Hotels": return hotelsPanel(trip);
    case "Flights": return flightsPanel(trip);
    case "Budget": return budgetPanel(plan);
    case "Packing List": return packPanel(plan);
    case "Warnings": return warnPanel(plan);
    default: return el("div");
  }
}

function itineraryPanel(plan, interests = []) {
  const dayList = el("div", { class: "day-tabs" });
  const content = el("div", {});
  const render = (i) => {
    [...dayList.children].forEach((n, idx) => n.classList.toggle("is-active", idx === i));
    const d = plan.dailyPlan[i];
    const activities = interests.length ? filterActivities(d.activities, interests) : d.activities;
    content.innerHTML = "";
    content.appendChild(el("h3", { text: `Day ${d.day}`, style: "margin-bottom:2px" }));
    content.appendChild(el("div", { class: "muted", style: "font-size:13px;margin-bottom:12px", text: d.label }));
    (activities.length ? activities : d.activities).forEach((a) => {
      content.appendChild(el("div", { class: "itin-item" }, [
        el("div", { class: "itin-item__time", text: a.time }),
        el("div", { class: "itin-item__body" }, [
          el("div", { class: "itin-item__title", text: a.title }),
          el("div", { class: "itin-item__desc", text: a.description }),
        ]),
        a.image ? el("img", { class: "itin-item__img", src: a.image, alt: "", loading: "lazy", onerror: function () { this.remove(); } }) : null,
      ]));
    });
  };
  plan.dailyPlan.forEach((d, i) => {
    const pill = el("button", { class: "day-pill" + (i === 0 ? " is-active" : "") }, [
      el("b", { text: `Day ${d.day}` }), document.createTextNode(d.label),
    ]);
    pill.addEventListener("click", () => render(i));
    dayList.appendChild(pill);
  });
  render(0);
  return el("div", { class: "itin-layout" }, [dayList, content]);
}

function placesPanel(trip) {
  const ranked = rankPlaces(trip.plan.bestPlaces, { interests: trip.interests, weather: trip.weather });
  const wrap = el("div", {});
  ranked.forEach((p) => wrap.appendChild(el("div", { class: "list-card" }, [
    el("img", { class: "list-card__img", src: p.image, alt: "", loading: "lazy", onerror: function () { this.style.visibility = "hidden"; } }),
    el("div", { class: "list-card__body" }, [
      el("div", { class: "list-card__title" }, [document.createTextNode(p.name), el("span", { class: "score", text: `★ ${p.score}` })]),
      el("div", { class: "list-card__sub", text: p.description }),
      el("div", { class: "list-card__meta" }, [el("span", { class: "tag tag--teal", text: cap(p.category) })]),
    ]),
  ])));
  return wrap;
}

function hotelsPanel(trip) {
  const wrap = el("div", {});
  (trip.hotels || []).forEach((h) => wrap.appendChild(el("div", { class: "list-card" }, [
    el("img", { class: "list-card__img", src: h.image, alt: "", loading: "lazy", onerror: function () { this.style.visibility = "hidden"; } }),
    el("div", { class: "list-card__body" }, [
      el("div", { class: "list-card__title" }, [document.createTextNode(h.name), el("span", { class: "score", text: money(h.pricePerNight) + "/night" })]),
      el("div", { class: "list-card__sub", text: `${"★".repeat(h.stars)} · ${h.rating} (${h.reviews} reviews)` }),
      el("div", { class: "list-card__meta" }, h.amenities.map((a) => el("span", { class: "tag tag--blue", text: a }))),
    ]),
  ])));
  return wrap;
}

function flightsPanel(trip) {
  const wrap = el("div", {});
  (trip.flights || []).forEach((f) => wrap.appendChild(el("div", { class: "list-card", style: "align-items:center" }, [
    el("div", { class: "list-card__body" }, [
      el("div", { class: "list-card__title" }, [document.createTextNode(`✈ ${f.airline}`), el("span", { class: "score", text: money(f.price) })]),
      el("div", { class: "list-card__sub", text: `${f.from} ${f.depart} → ${f.to} ${f.arrive} · ${Math.floor(f.durationMin/60)}h ${f.durationMin%60}m · ${f.stops ? f.stops + " stop" : "Nonstop"}` }),
      el("div", { class: "list-card__meta" }, [el("span", { class: "tag tag--purple", text: cap(f.class) })]),
    ]),
  ])));
  return wrap;
}

function budgetPanel(plan) {
  const b = plan.budget;
  const wrap = el("div", {});
  wrap.appendChild(el("div", { class: "budget-total" }, [
    el("span", { text: "Total estimated budget" }),
    el("span", { class: "amt", text: money(b.total, b.currency) }),
  ]));
  const colors = ["#2563eb", "#14b8a6", "#f59e0b", "#8b5cf6", "#0ea5e9"];
  b.breakdown.forEach((row, i) => {
    const pct = Math.round((row.amount / b.total) * 100);
    wrap.appendChild(el("div", { style: "margin-bottom:12px" }, [
      el("div", { class: "budget-row" }, [el("span", { text: row.label }), el("b", { text: money(row.amount, b.currency) + ` · ${pct}%` })]),
      el("div", { class: "budget-bar" }, [el("i", { style: `width:${pct}%;background:${colors[i % colors.length]}` })]),
    ]));
  });
  return wrap;
}

function packPanel(plan) {
  const grid = el("div", { class: "pack-grid" });
  plan.packingList.forEach((p) => grid.appendChild(el("label", { class: "pack-item" }, [el("input", { type: "checkbox" }), document.createTextNode(p)])));
  return grid;
}

function warnPanel(plan) {
  const wrap = el("div", {});
  plan.warnings.forEach((w) => wrap.appendChild(el("div", { class: "warn-item" }, [document.createTextNode("⚠️ "), document.createTextNode(w)])));
  return wrap;
}

/* ---------- Weather + Sidebar ---------- */
function buildWeather(trip) {
  const w = trip.weather;
  const days = el("div", { class: "forecast" });
  (w.daily || []).slice(0, 7).forEach((d) => days.appendChild(el("div", { class: "forecast__day" }, [
    el("b", { text: d.day }), el("div", { text: d.icon, style: "font-size:18px" }),
    el("div", { class: "t", text: d.max + "°" }), el("div", { class: "tl", text: d.min + "°" }),
  ])));
  return el("div", { class: "weather-banner" }, [
    el("div", { class: "weather-now" }, [
      el("div", { class: "weather-now__temp", text: w.current.temp + "°C" }),
      el("div", { class: "weather-now__desc", text: `${w.current.icon} ${w.current.desc}` }),
      el("div", { class: "weather-now__meta", text: `${fmtRange(trip.dates.from, trip.dates.to)} · ${trip.location?.name || trip.destination}` }),
    ]),
    days,
  ]);
}

function buildSidebar(trip) {
  const b = trip.plan.budget;
  const budgetCard = el("div", { class: "card card--pad side-card" }, [
    el("h3", { text: "Estimated Budget", style: "margin-bottom:14px" }),
    el("div", { class: "budget-total" }, [el("span", { class: "muted", text: `For ${trip.travelers.total} travelers` }), el("span", { class: "amt", text: money(b.total, b.currency) })]),
    ...b.breakdown.map((r) => el("div", { class: "budget-row" }, [el("span", { text: r.label }), el("b", { text: money(r.amount, b.currency) })])),
  ]);
  const loc = trip.location || {};
  const quick = el("div", { class: "card card--pad side-card" }, [
    el("h3", { text: "Quick Info", style: "margin-bottom:8px" }),
    quickRow("💱", "Budget tier", cap(trip.budget.tier)),
    quickRow("🗺️", "Destination", loc.country || trip.destination),
    quickRow("🕒", "Time zone", loc.timezone || "—"),
    quickRow("📅", "Duration", `${trip.plan.dailyPlan.length} days`),
  ]);
  const replan = el("button", { class: "btn btn--primary btn--block", text: "Plan another trip", style: "margin-top:4px", onClick: () => { tripStore.setState({ trip: null, status: "idle" }); router.navigate("/"); } });
  return el("div", {}, [budgetCard, quick, replan]);
}
function quickRow(icon, label, val) {
  return el("div", { class: "quick-row" }, [document.createTextNode(icon + " "), el("span", { class: "muted", text: label }), el("b", { text: val })]);
}
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
