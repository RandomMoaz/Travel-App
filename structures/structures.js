export class TTLCache {
  #map = new Map();
  #ttl;
  constructor(ttlMs = 1000 * 60 * 30) { this.#ttl = ttlMs; }

  get(key) {
    const hit = this.#map.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) { this.#map.delete(key); return undefined; }

    this.#map.delete(key);
    this.#map.set(key, hit);
    return hit.value;
  }

  set(key, value) {
    this.#map.set(key, { value, expires: Date.now() + this.#ttl });
    return value;
  }

  has(key) { return this.get(key) !== undefined; }
  clear() { this.#map.clear(); }
  get size() { return this.#map.size; }
}

/**  queue used to retry failed async tasks with backoff. */
export class RetryQueue {
  #queue = [];
  #running = false;
  constructor(maxRetries = 2) { this.maxRetries = maxRetries; }

  /** enqueue  */
  enqueue(task, label = "task") {
    return new Promise((resolve, reject) => {
      this.#queue.push({ task, label, attempts: 0, resolve, reject });
      this.#drain();
    });
  }

  async #drain() {
    if (this.#running) return;
    this.#running = true;
    while (this.#queue.length) {
      const job = this.#queue.shift();
      try {
        job.resolve(await job.task());
      } catch (err) {
        job.attempts += 1;
        if (job.attempts <= this.maxRetries) {
          await new Promise((r) => setTimeout(r, 250 * job.attempts)); 
          this.#queue.push(job); 
        } else {
          job.reject(err);
        }
      }
    }
    this.#running = false;
  }
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const k = keyFn(item);
    if (!seen.has(k)) { seen.add(k); out.push(item); }
  }
  return out;
}
