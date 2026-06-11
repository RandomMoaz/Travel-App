export function debounce(fn, wait = 350) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** Tiny DOM helper: create an element with props + children. */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Format currency. */
export const money = (n, cur = "$") => `${cur}${Number(n).toLocaleString()}`;

/** Format a date range nicely. */
export function fmtRange(from, to) {
  const opt = { month: "short", day: "numeric", year: "numeric" };
  const a = new Date(from), b = new Date(to);
  if (isNaN(a) || isNaN(b)) return "";
  return `${a.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${b.toLocaleDateString("en-US", opt)}`;
}

/** Calculate days between two dates (inclusive). */
export function daysBetween(from, to) {
  const a = new Date(from), b = new Date(to);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/** Toast notifications. */
export function toast(msg, type = "") {
  let host = $(".toast-host");
  if (!host) { host = el("div", { class: "toast-host" }); document.body.appendChild(host); }
  const t = el("div", { class: `toast ${type ? "toast--" + type : ""}`, text: msg });
  host.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

export function hashKey(obj) {
  const s = typeof obj === "string" ? obj : JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return "k" + Math.abs(h);
}
