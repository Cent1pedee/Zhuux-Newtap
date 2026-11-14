import "@testing-library/dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom 未实现 matchMedia / scrollIntoView，测试环境补齐（不进入生产代码）
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/*
 * shadcn/ui 底层是 Radix，jsdom 缺这些浏览器 API 会让 RadioGroup / Slider / Dialog
 * 在渲染期直接抛错（表现为「找不到选项文字」而不是明确报错）。
 * 只补测试环境，不进生产包。
 */
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

for (const name of ["hasPointerCapture", "setPointerCapture", "releasePointerCapture"] as const) {
  if (!Element.prototype[name]) {
    Object.defineProperty(Element.prototype, name, { writable: true, value: () => false });
  }
}

if (!globalThis.DOMRect) {
  globalThis.DOMRect = class {
    constructor(
      public x = 0,
      public y = 0,
      public width = 0,
      public height = 0,
    ) {}
    get top() {
      return this.y;
    }
    get left() {
      return this.x;
    }
    get right() {
      return this.x + this.width;
    }
    get bottom() {
      return this.y + this.height;
    }
    toJSON() {
      return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
  } as unknown as typeof DOMRect;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
