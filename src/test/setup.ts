import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver; react-resizable-panels (ResizablePanelGroup)
// needs one to mount. A no-op stand-in is enough — tests don't resize panels.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

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
