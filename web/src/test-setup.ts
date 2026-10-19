// jsdom lacks these; Radix Select/Slider/Checkbox and sonner call them
Element.prototype.hasPointerCapture = () => false
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}
window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
