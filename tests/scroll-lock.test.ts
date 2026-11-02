import { beforeEach, describe, expect, it } from "vitest";
import { lockBodyScroll } from "@/lib/scroll-lock";

/**
 * 滚动锁的引用计数语义。
 *
 * 背景：设置弹窗与命令面板各自锁 body。原来两边各存一份快照，
 * 从命令面板点「打开设置」→ 面板先关（还原成 ""）→ 设置还开着但页面已解锁；
 * 反过来关闭顺序不对则永久锁死。这些用例锁住「谁最后关谁还原」。
 */
describe("lockBodyScroll", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

  it("第一个持有者锁住页面，最后一个释放才还原", () => {
    const releaseA = lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");

    const releaseB = lockBodyScroll();
    releaseA();
    expect(document.body.style.overflow).toBe("hidden");

    releaseB();
    expect(document.body.style.overflow).toBe("");
  });

  it("重复释放同一个句柄不会把计数减穿", () => {
    const releaseA = lockBodyScroll();
    const releaseB = lockBodyScroll();

    releaseA();
    releaseA(); // 严格模式下 effect 可能重复 cleanup
    expect(document.body.style.overflow).toBe("hidden");

    releaseB();
    expect(document.body.style.overflow).toBe("");
  });

  it("还原的是「锁之前」的值，不是硬编码的空串", () => {
    document.body.style.overflow = "auto";
    const release = lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");

    release();
    expect(document.body.style.overflow).toBe("auto");
  });
});
