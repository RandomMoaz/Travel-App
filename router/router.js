export class Router {
  #routes = {};
  #notFound = () => {};
  #current = null;

  on(path, handler) { this.#routes[path] = handler; return this; }
  setNotFound(fn) { this.#notFound = fn; return this; }

  start() {
    window.addEventListener("popstate", () => this.#resolve(location.pathname));
    document.addEventListener("click", (e) => {
      const a = e.target.closest("[data-link]");
      if (a) { e.preventDefault(); this.navigate(a.getAttribute("href")); }
    });
    this.#resolve(location.pathname);
  }

  navigate(path) {
    if (path === this.#current) return;
    history.pushState({}, "", path);
    this.#resolve(path);
  }

  #resolve(path) {
    this.#current = path;
    const handler = this.#routes[path] || this.#notFound;
    handler();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

export const router = new Router();
