class Store {
  #state;
  #subscribers = new Set();

  constructor(initial) { this.#state = initial; }

  getState() { return this.#state; }

  /** subscribe(fn) → returns unsubscribe(). */
  subscribe(fn) {
    this.#subscribers.add(fn);
    return () => this.#subscribers.delete(fn);
  }

  setState(patch) {
    this.#state = { ...this.#state, ...(typeof patch === "function" ? patch(this.#state) : patch) };
    this.#publish();
  }

  #publish() { for (const fn of this.#subscribers) fn(this.#state); }
}

export const tripStore = new Store({
  form: {
    destination: "", startDate: "", endDate: "",
    adults: 2, children: 1,
    budget: "medium", customBudget: "",
    interests: ["food", "adventure", "nature"],
    hotelRating: "4", flightClass: "economy", weatherPref: "warm", pace: "balanced",
    notes: "",
  },
  trip: null,        // current Trip instance
  status: "idle",    // idle | loading | ready | error
  tasks: [],         // generate-step progress
  error: null,
  savedTrips: [],
});
