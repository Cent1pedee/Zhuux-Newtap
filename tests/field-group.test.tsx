import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Field, FieldGroup } from "@/components/ui/primitives";

/**
 * Field / FieldGroup 的 label 语义回归。
 *
 * 背景：`<label>` 的点击激活会转发到「第一个可标注后代」。设置面板里把
 * Segmented（一排 button）或色板塞进 Field 时，点标题文字等于点了第一个选项：
 * 点「往前回溯」把壁纸重置回今天、点「图标来源」把自定义图标重置成自动图标，
 * 而且没有任何提示。FieldGroup 用 role="group" 避开这个行为。
 */
describe("FieldGroup 不转发点击", () => {
  it("点分组标题不会触发内部第一个按钮", () => {
    const onOption = vi.fn();
    render(
      <FieldGroup label="往前回溯" hint="0 = 今天">
        <button type="button" onClick={onOption}>
          今天
        </button>
      </FieldGroup>,
    );

    fireEvent.click(screen.getByText("往前回溯"));
    expect(onOption).not.toHaveBeenCalled();
  });

  it("分组带 role=group 与可访问名称", () => {
    render(
      <FieldGroup label="图标来源">
        <button type="button">自动</button>
      </FieldGroup>,
    );

    const group = screen.getByRole("group", { name: "图标来源" });
    expect(group).toBeTruthy();
  });
});

describe("Field 保留单控件的 label 行为", () => {
  it("点标题文字会把点击转发给里面的控件", () => {
    const onClick = vi.fn();
    render(
      <Field label="名称">
        <input aria-label="名称输入" onClick={onClick} />
      </Field>,
    );

    fireEvent.click(screen.getByText("名称"));
    expect(onClick).toHaveBeenCalled();
  });
});
