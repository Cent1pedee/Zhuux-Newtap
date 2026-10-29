import type { ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { ConfigProvider } from "@/lib/config-store";
import { ToastProvider } from "@/components/ui/primitives";

/** 组件测试统一包装：配置上下文 + Toast（页面里由 layout 提供） */
export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(
    <ConfigProvider>
      <ToastProvider>{ui}</ToastProvider>
    </ConfigProvider>,
  );
}
