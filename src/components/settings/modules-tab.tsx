"use client";

import { PROVINCES, citiesOf } from "@/config/cities";
import { Button, Field, Segmented, Switch, TextInput } from "@/components/ui/primitives";
import type { SettingsController } from "@/components/settings/controller";

/** 下拉框右侧的自绘箭头（原生 select 的箭头在深色下几乎看不见） */
function ChevronDown() {
  return (
    <svg
      className="weather-select-chevron"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 模块页签：时间 / 问候 / 便签 / 天气 / 一言 */
export function ModulesTab({ s }: { s: SettingsController }) {
  const { config, update, setProvinceDraft, draftProvince, selectCity, locateWeather } = s;
  const cities = citiesOf(draftProvince);

  return (
    <div className="settings-body">
      <section className="settings-section">
        <h3 className="settings-h3">时间</h3>
        <Switch
          checked={config.clock.show}
          onChange={(v) => update("clock", { show: v })}
          label="显示时钟"
          testId="clock-show"
        />
        <Switch
          checked={config.clock.showSeconds}
          onChange={(v) => update("clock", { showSeconds: v })}
          label="显示秒"
          testId="clock-seconds"
        />
        <Switch
          checked={config.greeting.show}
          onChange={(v) => update("greeting", { show: v })}
          label="显示问候语"
          testId="greeting-show"
        />
        <Field
          label="自定义问候语"
          hint="留空则按时段自动切换（早安 / 上午好 / 午安 / 下午好 / 晚上好 / 夜深了）"
        >
          <TextInput
            value={config.greeting.custom}
            onChange={(v) => update("greeting", { custom: v })}
            placeholder="例如：今天也要加油"
            maxLength={20}
            ariaLabel="自定义问候语"
            testId="greeting-custom"
          />
        </Field>
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">待办便签（可选）</h3>
        <Switch
          checked={config.note.enabled}
          onChange={(v) => update("note", { enabled: v })}
          label="显示待办便签"
          description="默认开启。纯文本，直接保存在本机配置里，随导出/导入与一键清除一起处理，不会上传。"
          testId="note-enable"
        />
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">天气</h3>
        <Switch
          checked={config.weather.enabled}
          onChange={(v) => update("weather", { enabled: v })}
          label="显示天气"
          description="默认开启。首次打开会尝试一次浏览器定位；不授权就选城市。坐标只发给 api.open-meteo.com（已在内置白名单），不带任何本地数据。"
          testId="weather-enable"
        />
        {config.weather.enabled ? (
          <div className="space-y-2 pt-1">
            <div className="py-1">
              <span className="mb-1.5 block text-[13px] font-medium">温度单位</span>
              <Segmented
                options={[
                  { value: "c", label: "摄氏 °C" },
                  { value: "f", label: "华氏 °F" },
                ]}
                value={config.weather.unit}
                onChange={(v) => update("weather", { unit: v })}
                label="温度单位"
                testId="weather-unit"
              />
            </div>
            {/*
              省份 + 城市两个原生下拉，不再让用户手填经纬度：
              经纬度是机器坐标，人不知道自己家的两位小数是多少。
              省份只是「切城市列表」的草稿，选城市才写回坐标 ——
              否则一选省份就被强行改成该省第一个城市。
            */}
            <div className="py-1">
              <span className="mb-1.5 block text-[13px] font-medium">城市</span>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="weather-select-wrap">
                  <select
                    aria-label="省份"
                    data-testid="weather-province"
                    value={draftProvince}
                    onChange={(e) => setProvinceDraft(e.target.value)}
                    className="weather-select"
                  >
                    <option value="">选择省份</option>
                    {PROVINCES.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown />
                </div>
                <div className="weather-select-wrap">
                  <select
                    aria-label="城市"
                    data-testid="weather-city-select"
                    value={cities.some((c) => c.name === config.weather.city) ? config.weather.city : ""}
                    onChange={(e) => selectCity(e.target.value)}
                    disabled={cities.length === 0}
                    className="weather-select"
                  >
                    <option value="">{cities.length === 0 ? "先选省份" : "选择城市"}</option>
                    {cities.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Button onClick={() => void locateWeather()} size="sm" testId="weather-locate">
                使用我的定位
              </Button>
              {/* 状态用一枚小药丸表示，而不是再写一行「当前：省 · 市」——
                  城市名已经在左侧下拉里明摆着，重复一遍只是噪音。 */}
              <span className="weather-status" data-source={config.weather.source} data-testid="weather-status">
                <span className="weather-status-dot" aria-hidden="true" />
                {config.weather.source === "geo"
                  ? "已定位"
                  : config.weather.source === "manual"
                    ? "手动选择"
                    : "未选择"}
              </span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">每日一言</h3>
        <Switch
          checked={config.quote.show}
          onChange={(v) => update("quote", { show: v })}
          label="显示每日一言"
          testId="quote-show"
        />
        <div className="py-2">
          <span className="mb-1.5 block text-[13px] font-medium">数据源</span>
          <Segmented
            options={[
              { value: "local", label: "内置语录库" },
              { value: "remote", label: "远程 API" },
            ]}
            value={config.quote.source}
            onChange={(v) => update("quote", { source: v })}
            label="一言数据源"
            testId="quote-source"
          />
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
            默认走远程 API（v1.hitokoto.cn），3 秒超时自动回退内置语录库；切成内置库则完全不发网络请求。
          </p>
        </div>
      </section>
    </div>
  );
}
