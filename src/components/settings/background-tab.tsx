"use client";

import { Input } from "@/components/ui/input";
import { Button, FieldGroup, Range, Segmented, Switch, TextInput } from "@/components/ui/primitives";
import type { SettingsController } from "@/components/settings/controller";

/** 背景页签：壁纸来源 → 显示效果 → 自定义图片 */
export function BackgroundTab({ s }: { s: SettingsController }) {
  const {
    config,
    update,
    wallpaperUrl,
    setWallpaperUrl,
    wallpaperFileRef,
    applyWallpaperUrl,
    onWallpaperFile,
    clearWallpaper,
  } = s;

  return (
    <div className="settings-body">
      <section className="settings-section">
        <h3 className="settings-h3">壁纸来源</h3>
        <Switch
          checked={config.background.source === "edge"}
          onChange={(v) => update("background", { source: v ? "edge" : "none" })}
          label="使用每日壁纸"
          description="Edge / Bing 每日一图；关闭后只剩纯渐变底色，第三方请求降为 0。"
          testId="background-edge"
        />
        <FieldGroup label="往前回溯" hint="0 = 今天；想看前几天的图可以往后调">
          <Segmented
            options={[
              { value: "0", label: "今天" },
              { value: "1", label: "-1 天" },
              { value: "3", label: "-3 天" },
              { value: "7", label: "-7 天" },
            ]}
            value={String(config.background.offset)}
            onChange={(v) => update("background", { offset: Number(v) })}
            label="壁纸回溯天数"
            testId="background-offset"
          />
        </FieldGroup>
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">显示效果</h3>
        <Switch
          checked={config.background.vignette}
          onChange={(v) => update("background", { vignette: v })}
          label="壁纸暗角"
          description="四角轻微压暗，视线落在时间与快捷方块上。"
          testId="background-vignette"
        />
        <Range
          label="暗化程度"
          min={0}
          max={70}
          value={config.background.dim}
          onChange={(v) => update("background", { dim: v })}
          suffix="%"
          testId="wallpaper-dim"
        />
        <Range
          label="基础模糊"
          min={0}
          max={20}
          value={config.background.blur}
          onChange={(v) => update("background", { blur: v })}
          suffix="px"
          testId="wallpaper-blur"
        />
        <Switch
          checked={config.background.kenBurns}
          onChange={(v) => update("background", { kenBurns: v })}
          label="Ken Burns 缓慢缩放"
          testId="wallpaper-kenburns"
        />
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">自定义图片</h3>
        <p className="settings-note">优先级高于每日壁纸；留空或点「移除」回到每日壁纸。</p>
        <div className="settings-actions settings-actions--row">
          <div className="min-w-0 flex-1">
            <TextInput
              value={wallpaperUrl}
              onChange={setWallpaperUrl}
              placeholder="https://example.com/bg.jpg"
              ariaLabel="远程背景图片地址"
              testId="wallpaper-url"
            />
          </div>
          <Button onClick={applyWallpaperUrl} size="sm" testId="wallpaper-url-apply">
            应用
          </Button>
        </div>
        <div className="settings-actions mt-2">
          <Button onClick={() => wallpaperFileRef.current?.click()} size="sm" testId="wallpaper-upload">
            选择本地图片
          </Button>
          <Input
            ref={wallpaperFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid="wallpaper-file"
            onChange={(e) => onWallpaperFile(e.target.files?.[0])}
          />
          <Button onClick={clearWallpaper} size="sm" variant="ghost" testId="wallpaper-clear">
            移除图片
          </Button>
          <span className="text-[11px] text-[var(--fg-subtle)]">小于 8MB，仅存本机</span>
        </div>
      </section>
    </div>
  );
}
