import { router } from "./router/router.js";
import { tripStore } from "./store/trip.store.js";
import { SearchView } from "./views/search.view.js";
import { GenerateView } from "./views/generate.view.js";
import { ResultsView } from "./views/result.view.js";
import { $ } from "./utils/utils.js";
import { tripStorage } from "./utils/storage.js";

const appRoot = $("#app");

function mount(viewFn) {
  appRoot.innerHTML = "";
  appRoot.appendChild(viewFn());
}

/** Keep the top stepper highlighting the active step. */
function setStep(active) {
  const order = { search: 1, generate: 2, results: 3 };
  $("#stepper").querySelectorAll(".step").forEach((s) => {
    const n = Number(s.dataset.step);
    s.classList.toggle("is-active", n === order[active]);
    s.classList.toggle("is-done", n < order[active]);
  });
}

router
  .on("/", () => { setStep("search"); mount(SearchView); })
  .on("/generate", () => { setStep("generate"); mount(GenerateView); })
  .on("/results", () => { setStep("results"); mount(ResultsView); })
  .setNotFound(() => router.navigate("/"));

/* Theme toggle (light/dark) with persistence */
const themeBtn = $("#themeToggle");
const applyTheme = (t) => {
  document.documentElement.setAttribute("data-theme", t);
  themeBtn.textContent = t === "dark" ? "☀️" : "🌙";
};
applyTheme(localStorage.getItem("journeyai:theme") || "light");
themeBtn.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem("journeyai:theme", next);
  applyTheme(next);
});

/* Brand click → home */
$("#brand").addEventListener("click", () => router.navigate("/"));

// Load persisted trips into store so SearchView's subscriber gets them on first paint.
tripStorage.allTrips().then((trips) => tripStore.setState({ savedTrips: trips }));

router.start();

// Expose for quick debugging in the console.
window.__journey = { tripStore, router };
