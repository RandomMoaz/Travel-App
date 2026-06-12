import { el, $, $$, debounce, toast, fmtRange } from "../utils/utils.js";
import { tripStore } from "../store/trip.store.js";
import { validateTrip, totalTravelers } from "../utils/validators.js";
import { createTrip } from "../models/trip.model.js";
import { geocode } from "../services/geo.service.js";
import { router } from "../router/router.js";
import { CONFIG } from "../config.js";
import { tripStorage } from "../utils/storage.js";

const INTERESTS = ["food", "shopping", "museums", "adventure", "nature", "beach", "history", "nightlife", "family-friendly"];

export function SearchView() {
  const f = tripStore.getState().form;

  const root = el("div", { class: "view container", style: "max-width:760px" }, [
    el("div", { class: "search-head" }, [
      el("h1", { html: "Let's plan your perfect trip ✈️" }),
      el("p", { class: "muted", text: "Tell us about your trip and preferences." }),
    ]),
    buildForm(f),
    buildSavedSection(),
  ]);
  return root;
}

function buildForm(f) {
  const card = el("div", { class: "card card--pad" });

  // Destination (with debounced autocomplete)
  const destError = el("div", { class: "field__error", text: "Please enter a destination." });
  const destInput = el("input", { class: "input", id: "destination", placeholder: "e.g. Paris, France or Europe", value: f.destination, autocomplete: "off" });
  const suggestions = el("div", { class: "card", style: "position:absolute;left:0;right:0;top:100%;margin-top:6px;z-index:30;overflow:hidden;display:none" });
  const destWrap = el("div", { class: "field", style: "position:relative" }, [
    el("label", { class: "field__label", for: "destination", text: "Destination" }),
    destInput, suggestions, destError,
  ]);

  const runSearch = debounce(async (q) => {
    try {
      const results = await geocode(q);
      suggestions.innerHTML = "";
      if (!results.length) {
        suggestions.appendChild(el("div", { class: "quick-row", style: "padding:11px 14px;color:var(--muted)", text: "No destinations found." }));
        suggestions.style.display = "block";
        return;
      }
      results.forEach((r) => {
        suggestions.appendChild(el("div", {
          class: "quick-row", style: "padding:11px 14px;cursor:pointer;border-bottom:1px solid var(--border)",
          text: r.label,
          onClick: () => { destInput.value = r.label; destInput.dataset.lat = r.lat; destInput.dataset.lon = r.lon; suggestions.style.display = "none"; },
        }));
      });
      suggestions.style.display = "block";
    } catch { suggestions.style.display = "none"; }
  }, CONFIG.debounceMs);
  destInput.addEventListener("input", (e) => { if (e.target.value.trim().length >= 2) runSearch(e.target.value); else suggestions.style.display = "none"; });
  const hideOnOutsideClick = (e) => {
    if (!destWrap.isConnected) { document.removeEventListener("click", hideOnOutsideClick); return; }
    if (!destWrap.contains(e.target)) suggestions.style.display = "none";
  };
  document.addEventListener("click", hideOnOutsideClick);

  // Dates
  const startInput = el("input", { class: "input", type: "date", id: "startDate", value: f.startDate });
  const endInput = el("input", { class: "input", type: "date", id: "endDate", value: f.endDate });
  const dates = el("div", {}, [
    el("label", { class: "section-label", text: "Travel Dates" }),
    el("div", { class: "grid-2" }, [
      field("Start Date", startInput, "startDate"),
      field("End Date", endInput, "endDate"),
    ]),
  ]);

  // Travelers
  const adults = counter("Adults", f.adults, 1);
  const children = counter("Children", f.children, 0);
  const totalBadge = el("div", { class: "tag tag--blue", text: `Total: ${totalTravelers(f)} Travelers` });
  const updateTotal = () => totalBadge.textContent = `Total: ${Number(adults.value()) + Number(children.value())} Travelers`;
  adults.onChange(updateTotal); children.onChange(updateTotal);
  const travelers = el("div", {}, [
    el("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:10px" }, [
      el("label", { class: "section-label", style: "margin:0", text: "Travelers" }), totalBadge,
    ]),
    el("div", { class: "grid-2" }, [adults.node, children.node]),
  ]);

  // Budget
  const budget = budgetGroup(f.budget, f.customBudget);

  // Interests
  const interestWrap = el("div", { class: "chips" });
  const selected = new Set(f.interests);
  INTERESTS.forEach((name) => {
    const chip = el("label", { class: "chip" + (selected.has(name) ? " is-selected" : ""), text: cap(name) });
    chip.addEventListener("click", () => {
      if (selected.has(name)) { selected.delete(name); chip.classList.remove("is-selected"); }
      else { selected.add(name); chip.classList.add("is-selected"); }
    });
    interestWrap.appendChild(chip);
  });
  const interestsError = el("div", { class: "field__error", id: "interests", text: "Please select at least one interest." });
  const interests = el("div", { class: "field", style: "margin-bottom:22px" }, [
    el("label", { class: "section-label" }, [document.createTextNode("Interests "), el("span", { class: "field__hint", text: "(Select all that apply)" })]),
    interestWrap,
    interestsError,
  ]);

  // Preferences
  const hotelRating = select("Hotel Rating", "hotelRating", [["3", "3 Stars & above"], ["4", "4 Stars & above"], ["5", "5 Stars only"]], f.hotelRating);
  const flightClass = select("Flight Class", "flightClass", [["economy", "Economy"], ["business", "Business"], ["first", "First"]], f.flightClass);
  const weatherPref = select("Weather Preference", "weatherPref", [["warm", "Warm"], ["mild", "Mild"], ["cold", "Cold"]], f.weatherPref);
  const pace = select("Trip Pace", "pace", [["relaxed", "Relaxed"], ["balanced", "Balanced"], ["packed", "Packed"]], f.pace);
  const prefs = el("div", { style: "margin-bottom:22px" }, [
    el("label", { class: "section-label", text: "Preferences" }),
    el("div", { class: "grid-4" }, [hotelRating.node, flightClass.node, weatherPref.node, pace.node]),
  ]);

  // Notes
  const notes = el("textarea", { class: "input", id: "notes", placeholder: "Any special requests, celebrations, accessibility needs…", text: f.notes });
  const notesField = el("div", { class: "field" }, [
    el("label", { class: "field__label" }, [document.createTextNode("Special Notes "), el("span", { class: "field__hint", text: "(Optional)" })]),
    notes,
  ]);

  // Submit
  const submit = el("button", { class: "btn btn--primary btn--lg btn--block", html: "Generate My Trip Plan&nbsp; →" });
  submit.addEventListener("click", () => {
    const form = {
      destination: destInput.value, startDate: startInput.value, endDate: endInput.value,
      adults: adults.value(), children: children.value(),
      budget: budget.value(), customBudget: budget.customValue(),
      interests: [...selected],
      hotelRating: hotelRating.value(), flightClass: flightClass.value(), weatherPref: weatherPref.value(), pace: pace.value(),
      notes: notes.value, lat: destInput.dataset.lat, lon: destInput.dataset.lon,
    };
    const { valid, errors } = validateTrip(form);
    $$(".field--invalid", card).forEach((n) => n.classList.remove("field--invalid"));
    if (!valid) {
      Object.keys(errors).forEach((k) => $(`#${k}`)?.closest(".field")?.classList.add("field--invalid"));
      toast(Object.values(errors)[0], "err");
      return;
    }
    const trip = createTrip(form);
    if (destInput.dataset.lat) trip.location = { name: destInput.value, lat: +destInput.dataset.lat, lon: +destInput.dataset.lon };
    tripStore.setState({ form, trip, status: "loading" });
    router.navigate("/generate");
  });

  card.append(destWrap, dates, travelers, budget.node, interests, prefs, notesField, submit);
  return card;
}

/* ---------- small builders ---------- */
function field(label, input, id) {
  return el("div", { class: "field", style: "margin:0" }, [
    el("label", { class: "field__label", for: id, text: label }), input,
    el("div", { class: "field__error", text: "Required." }),
  ]);
}
function counter(label, initial, min) {
  let val = Number(initial);
  const valEl = el("span", { class: "counter__val", text: String(val) });
  const cbs = [];
  const dec = el("button", { class: "counter__btn", text: "−", type: "button" });
  const inc = el("button", { class: "counter__btn", text: "+", type: "button" });
  dec.addEventListener("click", () => { if (val > min) { val--; valEl.textContent = val; cbs.forEach((f) => f()); } });
  inc.addEventListener("click", () => { val++; valEl.textContent = val; cbs.forEach((f) => f()); });
  const node = el("div", { class: "counter" }, [
    el("span", { class: "counter__label", text: label }),
    el("div", { class: "counter__controls" }, [dec, valEl, inc]),
  ]);
  return { node, value: () => val, onChange: (f) => cbs.push(f) };
}
function budgetGroup(initial, initialCustom) {
  let current = initial;
  const tiers = [["low", "Low", "$"], ["medium", "Medium", "$$"], ["luxury", "Luxury", "$$$"], ["custom", "Custom", "Enter amount"]];
  const customInput = el("input", { class: "input", type: "number", placeholder: "Amount", value: initialCustom, style: "margin-top:8px;display:" + (initial === "custom" ? "block" : "none") });
  const grid = el("div", { class: "choice-grid" });
  const choices = tiers.map(([val, title, sub]) => {
    const c = el("div", { class: "choice" + (val === current ? " is-selected" : "") }, [
      el("div", { class: "choice__title", text: title }), el("div", { class: "choice__sub", text: sub }),
    ]);
    c.addEventListener("click", () => {
      current = val;
      grid.querySelectorAll(".choice").forEach((n) => n.classList.remove("is-selected"));
      c.classList.add("is-selected");
      customInput.style.display = val === "custom" ? "block" : "none";
    });
    return c;
  });
  grid.append(...choices);
  const node = el("div", { style: "margin-bottom:22px" }, [
    el("label", { class: "section-label", text: "Budget" }), grid, customInput,
  ]);
  return { node, value: () => current, customValue: () => customInput.value };
}
function select(label, id, options, selected) {
  const sel = el("select", { class: "select", id });
  options.forEach(([v, t]) => { const o = el("option", { value: v, text: t }); if (v === selected) o.selected = true; sel.appendChild(o); });
  const node = el("div", { class: "field", style: "margin:0" }, [
    el("label", { class: "field__label", for: id, text: label }), sel,
  ]);
  return { node, value: () => sel.value };
}
function buildSavedSection() {
  const list = el("div", { class: "saved-list" });
  const empty = el("p", { class: "muted", style: "text-align:center;padding:20px 0;font-size:14px", text: "No saved trips yet. Generate a plan and save it!" });

  const renderCards = (trips) => {
    list.innerHTML = "";
    empty.style.display = trips.length ? "none" : "";
    trips.forEach((t) => {
      const deleteBtn = el("button", { class: "btn btn--secondary", style: "padding:4px 10px;font-size:12px;margin-top:8px", text: "Delete" });
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await tripStorage.deleteTrip(t.id);
        const all = await tripStorage.allTrips();
        tripStore.setState({ savedTrips: all });
      });
      const card = el("div", { class: "saved-card" }, [
        el("div", { style: "font-weight:700;margin-bottom:4px", text: t.destination }),
        el("div", { class: "muted", style: "font-size:13px", text: fmtRange(t.dates.from, t.dates.to) + ` · ${t.travelers.total} traveler${t.travelers.total !== 1 ? "s" : ""}` }),
        el("div", { class: "muted", style: "font-size:12px;margin-top:6px", text: cap(t.budget.tier) + " budget" }),
        t.plan?.summary ? el("div", { style: "font-size:12px;margin-top:8px;color:var(--text);opacity:.75;line-clamp:2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical", text: t.plan.summary }) : null,
        deleteBtn,
      ]);
      card.addEventListener("click", () => {
        tripStore.setState({ trip: t, status: "ready" });
        router.navigate("/results");
      });
      list.appendChild(card);
    });
  };

  renderCards(tripStore.getState().savedTrips);

  // Observer pattern: re-render the list whenever savedTrips changes in the store.
  // Auto-unsubscribes when the view is unmounted (element leaves the DOM).
  const unsub = tripStore.subscribe((state) => {
    if (!list.isConnected) { unsub(); return; }
    renderCards(state.savedTrips);
  });

  return el("div", { class: "card card--pad", style: "margin-top:22px" }, [
    el("h2", { style: "margin-bottom:14px;font-size:18px", text: "Saved Trips" }),
    empty,
    list,
  ]);
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
