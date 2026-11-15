"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** 降级文案里的模块名，例如「天气」 */
  label: string;
  /** 浮层类模块崩了就直接不渲染，不要弹一块占位出来 */
  silent?: boolean;
  testId?: string;
};

type State = { failed: boolean };

/**
 * 模块级错误边界。
 *
 * React 19 在渲染期抛错时会卸载整棵树 —— app/error.tsx 只能兜到整页，
 * 于是一个天气组件的数据结构错误就能让时钟、搜索、Dock 一起消失。
 * 这里按模块隔离：谁的渲染炸了谁降级，其余照常。
 *
 * 注意边界只拦渲染 / 生命周期错误，拦不住事件回调与异步 rejection，
 * 那些仍由各自的 catch 处理。
 */
export class WidgetBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 生产环境没有 Overlay，只能靠这一行定位是哪个模块
    console.error(`[widget:${this.props.label}] 渲染失败`, error, info.componentStack);
  }

  private reset = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.silent) return null;

    return (
      <div
        role="status"
        data-testid={this.props.testId ?? "widget-fallback"}
        className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--panel-bg)] px-3 py-2 text-[12px] text-[var(--fg-muted)]"
      >
        <span>{this.props.label}暂时不可用</span>
        <button
          type="button"
          onClick={this.reset}
          className="rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[12px] text-[var(--accent)] transition-opacity hover:opacity-80"
        >
          重试
        </button>
      </div>
    );
  }
}
