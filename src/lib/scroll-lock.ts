/**
 * 页面滚动锁（引用计数）。
 *
 * 为什么需要它：设置面板与命令面板各自都会「打开时把 body 锁死、关闭时还原」。
 * 原来两边各存一份 `document.body.style.overflow` 快照，谁后关谁说了算 ——
 * 从命令面板里点「打开设置」时，面板先关、设置后开，关设置时还原的是
 * 「面板打开时」那份 `hidden`，于是**页面永远滚不动了**；反过来则会提前解锁。
 *
 * 现在统一走这里：第一个持有者锁、最后一个持有者还原，顺序无关。
 * 用函数式解构（返回 release）而不是 lock/unlock 两个函数，
 * 是为了让调用方在 effect cleanup 里一次性释放，不会漏掉配平。
 */

let lockCount = 0;
let previousOverflow = "";

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;

  let released = false;
  return () => {
    // 同一个 release 被调用两次（React 18 严格模式下 effect 会重跑）不能多减一次
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) document.body.style.overflow = previousOverflow;
  };
}
