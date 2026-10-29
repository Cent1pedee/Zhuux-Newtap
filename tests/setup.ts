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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
