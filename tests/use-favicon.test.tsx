import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useFaviconChain } from "@/lib/use-favicon";

/**
 * favicon 候选链的「断点续传」：
 * 排序 / 切布局 / 重开设置都会让图标重新挂载，如果每次都从 favicon.ico 重来，
 * 用户会看到图标先退回字母、再补回原来的那张 —— 也就是「调序后 icon 错乱」。
 * 这里守的是：重新挂载后直接从上次的候选与加载状态继续。
 */

function Probe({ url }: { url: string }) {
  const favicon = useFaviconChain(url, true);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-testid="probe"
      alt=""
      src={favicon.src || undefined}
      data-loaded={String(favicon.loaded)}
      onLoad={favicon.onLoad}
      onError={favicon.onError}
    />
  );
}

describe("useFaviconChain", () => {
  it("失败后推进到下一个候选；重新挂载从该候选继续，且不丢已加载状态", () => {
    const url = "https://remount.example.com/very/deep/path";
    const first = render(<Probe url={url} />);

    expect(screen.getByTestId("probe").getAttribute("src")).toBe("https://remount.example.com/favicon.ico");
    fireEvent.error(screen.getByTestId("probe"));

    const advanced = screen.getByTestId("probe");
    expect(advanced.getAttribute("src")).toBe("https://remount.example.com/apple-touch-icon.png");
    fireEvent.load(advanced);
    expect(screen.getByTestId("probe").getAttribute("data-loaded")).toBe("true");

    first.unmount();

    // 模拟拖动排序导致的重新挂载：不应该再回到 favicon.ico，也不应该重新显示字母
    render(<Probe url={url} />);
    const again = screen.getByTestId("probe");
    expect(again.getAttribute("src")).toBe("https://remount.example.com/apple-touch-icon.png");
    expect(again.getAttribute("data-loaded")).toBe("true");
  });

  it("候选全部试完后记住该结果，重新挂载不再重复探测", () => {
    const url = "https://empty.example.com";
    const first = render(<Probe url={url} />);
    for (let i = 0; i < 3; i += 1) {
      fireEvent.error(screen.getByTestId("probe"));
    }
    expect(screen.getByTestId("probe").getAttribute("src")).toBeNull();
    first.unmount();

    render(<Probe url={url} />);
    expect(screen.getByTestId("probe").getAttribute("src")).toBeNull();
  });

  it("缓存按站点 URL 隔离，一个站点的失败不影响另一个", () => {
    render(<Probe url="https://a.example.com" />);
    fireEvent.error(screen.getByTestId("probe"));

    render(<Probe url="https://b.example.com" />);
    const [a, b] = screen.getAllByTestId("probe");
    expect(a.getAttribute("src")).toBe("https://a.example.com/apple-touch-icon.png");
    expect(b.getAttribute("src")).toBe("https://b.example.com/favicon.ico");
  });
});
