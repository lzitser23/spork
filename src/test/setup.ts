import "@testing-library/jest-dom/vitest";

// Newer Node (>=22, on by default in 25+) ships a native `localStorage` global
// that shadows jsdom's `window.localStorage`. That native store isn't wired to
// a backing store here and doesn't expose the full Storage API, so tests that
// call `localStorage.clear()` throw "clear is not a function". Install a
// deterministic in-memory Storage on both globals — beating the native one via
// defineProperty — so storage behaves identically regardless of Node's flags.
class MemoryStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
}
const memoryStorage = new MemoryStorage() as unknown as Storage;
for (const target of [globalThis, window] as const) {
  Object.defineProperty(target, "localStorage", {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}

// jsdom has no ResizeObserver; react-resizable-panels (ResizablePanelGroup)
// needs one to mount. A no-op stand-in is enough — tests don't resize panels.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom has no matchMedia; the dot-matrix loaders query prefers-reduced-motion.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

// react-resizable-panels hit-tests every document-level pointerdown against
// the resize handles' getBoundingClientRect. jsdom reports (0,0,0,0) for all
// elements, so every simulated click "hits" a handle, which preventDefaults
// the event — stealing focus and swallowing clicks meant for other elements.
// Park handle rects far off-screen so that hit test always misses.
const offscreen = {
  x: -9999,
  y: -9999,
  width: 0,
  height: 0,
  top: -9999,
  left: -9999,
  right: -9999,
  bottom: -9999,
  toJSON: () => ({}),
} as DOMRect;
const realGetRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function (this: Element) {
  if (this.getAttribute?.("data-slot") === "resizable-handle") return offscreen;
  return realGetRect.call(this);
};
