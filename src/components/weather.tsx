"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { fetchWeather, weatherLabel, type WeatherNow } from "@/lib/services";
import { useToast } from "@/components/ui/primitives";
import { EASE_OUT_CUBIC } from "@/lib/motion";
import { PROVINCES, citiesOf, findCity, nearestCity } from "@/config/cities";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: WeatherNow }
  | { status: "error"; message: string };

/** 本次会话是否已经试过自动定位，避免每次刷新都弹权限框 */
const GEOLOCATION_TRIED_KEY = "startpage.geo.tried";

function WeatherGlyph({ code, size = 17 }: { code: number; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
  } as const;
  if (code === 0) {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path
          d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (code <= 3) {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M7 18h9.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.2A4 4 0 0 0 7 18Z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (code <= 48) {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M4 8h16M6 12h13M4 16h15" strokeLinecap="round" />
      </svg>
    );
  }
  if (code <= 77) {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M7 15h9a3.2 3.2 0 0 0 .2-6.4A4.8 4.8 0 0 0 7.6 7.4 3.8 3.8 0 0 0 7 15Z" strokeLinejoin="round" />
        <path d="M8 18.5v.01M12 19.5v.01M16 18.5v.01" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <path d="M7 14h9a3.2 3.2 0 0 0 .2-6.4A4.8 4.8 0 0 0 7.6 6.4 3.8 3.8 0 0 0 7 14Z" strokeLinejoin="round" />
      <path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 天气（默认开启）。
 *
 * 取数优先级：手动选省 + 市 > 浏览器定位 > 空。
 * - 首次挂载若还没坐标，自动尝试一次定位（每会话一次，用 sessionStorage 打标，
 *   避免每次刷新都弹权限框）；授权后反查最近的城市回填下拉，用户随时能改。
 * - 定位被拒 / 失败 / 超时，就展开「选省份 → 选城市」两个原生下拉。
 *   两种入口都在卡片内，不必绕进设置面板。
 * - 坐标只用于向白名单内的 open-meteo 查询，不落任何远端。
 */
export function Weather() {
  const { config, update } = useConfig();
  const reduce = useReducedMotionPref();
  const { push } = useToast();
  const [state, setState] = useState<State>({ status: "idle" });
  const [picking, setPicking] = useState(false);
  const [provinceDraft, setProvinceDraft] = useState("");
  const autoTried = useRef(false);

  const { enabled, lat, lon, unit, province, city, source } = config.weather;

  const load = useCallback(
    async (latitude: number, longitude: number) => {
      setState({ status: "loading" });
      try {
        const data = await fetchWeather(latitude, longitude, unit, config.privacy.whitelist);
        setState({ status: "ready", data });
      } catch (err) {
        setState({ status: "error", message: err instanceof Error ? err.message : "天气获取失败" });
      }
    },
    [unit, config.privacy.whitelist],
  );

  useEffect(() => {
    if (!enabled || lat === null || lon === null) {
      setState({ status: "idle" });
      return;
    }
    void load(lat, lon);
    // 每 15 分钟刷新一次
    const timer = window.setInterval(() => void load(lat, lon), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [enabled, lat, lon, load]);

  /** 定位 → 反查最近城市 → 回填省/市，用户之后想改随时改 */
  const requestLocation = useCallback(
    (silent = false) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        // 静默那次同样保持安静：首屏不该自己弹出一个城市下拉，
        // 否则用户刚想点「选城市」就已经被它顶开/关掉（真机上表现为闪一下）。
        if (!silent) {
          push("当前浏览器不支持定位，请手动选择城市", "error");
          setPicking(true);
        }
        return;
      }
      setState({ status: "loading" });
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latitude = Number(pos.coords.latitude.toFixed(3));
          const longitude = Number(pos.coords.longitude.toFixed(3));
          const near = nearestCity(latitude, longitude);
          update("weather", {
            lat: latitude,
            lon: longitude,
            province: near?.province ?? "",
            city: near?.city.name ?? "",
            source: "geo",
          });
          if (!silent) push(near ? `已定位到 ${near.city.name}` : "定位成功", "success");
        },
        (err) => {
          setState({ status: "idle" });
          // 静默自动定位失败时不要把两个下拉直接怼到首屏上 ——
          // 首屏应该安静，用户想选城市时点一下位置钮再展开；
          // 只有用户主动点定位（silent=false）才替他展开，省一次点击。
          if (!silent) {
            setPicking(true);
            push(err.code === err.PERMISSION_DENIED ? "定位未授权，请手动选择城市" : "定位失败，请手动选择城市", "info");
          }
        },
        { timeout: 8000, maximumAge: 30 * 60 * 1000 },
      );
    },
    [push, update],
  );

  // 首次挂载、已开启但还没有坐标 → 自动试一次定位（每会话一次）
  useEffect(() => {
    if (!enabled) return;
    if (lat !== null && lon !== null) return;
    if (autoTried.current) return;
    autoTried.current = true;
    let tried = false;
    try {
      tried = window.sessionStorage.getItem(GEOLOCATION_TRIED_KEY) === "1";
      window.sessionStorage.setItem(GEOLOCATION_TRIED_KEY, "1");
    } catch {
      // sessionStorage 不可用（隐私模式）时就不记忆，本次仍试一次
    }
    if (tried) return;
    requestLocation(true);
  }, [enabled, lat, lon, requestLocation]);

  const applyCity = (nextProvince: string, nextCity: string) => {
    const hit = findCity(nextProvince, nextCity);
    if (!hit) return;
    update("weather", {
      province: nextProvince,
      city: nextCity,
      lat: hit.lat,
      lon: hit.lon,
      source: "manual",
    });
    setPicking(false);
    push(`天气城市已设为 ${nextCity}`, "success");
  };

  if (!enabled) return null;

  const cities = citiesOf(provinceDraft || province);
  const cityLabel = city && province && province.replace(/[省市]$/, "") !== city ? `${province} · ${city}` : city;

  return (
    <motion.div
      initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT_CUBIC }}
      className="weather-card"
      data-testid="weather"
      data-source={source}
    >
      <div className="weather-row">
        <span className="weather-glyph" aria-hidden="true">
          {state.status === "ready" ? (
            <WeatherGlyph code={state.data.code} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
            </svg>
          )}
        </span>

        <div className="min-w-0">
          {state.status === "ready" ? (
            <button
              type="button"
              onClick={() => lat !== null && lon !== null && void load(lat, lon)}
              title="点击刷新天气"
              data-testid="weather-refresh"
              className="weather-main"
            >
              <span className="weather-temp tabular-nums">
                {state.data.temperature}°
              </span>
              <span className="weather-unit">{unit.toUpperCase()}</span>
              <span className="weather-desc">{weatherLabel(state.data.code)}</span>
              {cityLabel ? <span className="weather-city">{cityLabel}</span> : null}
            </button>
          ) : state.status === "loading" ? (
            <span className="weather-main text-[var(--fg-subtle)]" data-testid="weather-loading">
              正在获取天气…
            </span>
          ) : state.status === "error" ? (
            <button
              type="button"
              onClick={() => (lat !== null && lon !== null ? void load(lat, lon) : setPicking(true))}
              data-testid="weather-retry"
              className="weather-main text-amber-400"
            >
              获取失败 · 点击重试
            </button>
          ) : (
            <span className="weather-main text-[var(--fg-muted)]" data-testid="weather-idle">
              选择天气城市
            </span>
          )}
        </div>

        {/* 两个小动作：换城市 / 重新定位。常态只显示图标，hover 显色，不抢视线 */}
        <div className="weather-actions">
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            aria-expanded={picking}
            aria-label="选择天气城市"
            title="选择城市"
            data-testid="weather-pick-open"
            className="weather-action"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" strokeLinejoin="round" />
              <circle cx="12" cy="10" r="2.4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => requestLocation(false)}
            aria-label="使用我的定位"
            title="使用我的定位"
            data-testid="weather-locate"
            className="weather-action"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/*
        城市选择面板：绝对定位浮在卡片下方，而不是把卡片撑高。
        卡片钉在左上角，一旦展开就把顶栏整条推下来，页面会跳一下 ——
        浮层是这个位置唯一不破坏布局的做法。
      */}
      <AnimatePresence initial={false}>
        {picking ? (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : -4, scale: reduce ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : -4, scale: reduce ? 1 : 0.98 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT_CUBIC }}
            className="weather-picker"
            data-testid="weather-picker"
          >
            <div className="weather-picker-head">
              <span>选择城市</span>
              <button
                type="button"
                onClick={() => setPicking(false)}
                aria-label="收起城市选择"
                className="weather-picker-close"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="weather-picker-grid">
              <label className="weather-field">
                <span className="weather-field-label">省份</span>
                <div className="weather-select-wrap">
                  <select
                    id="weather-province"
                    data-testid="weather-province"
                    value={provinceDraft || province}
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
              </label>

              <label className="weather-field">
                <span className="weather-field-label">城市</span>
                <div className="weather-select-wrap">
                  <select
                    id="weather-city-select"
                    data-testid="weather-city-select"
                    value={cities.some((c) => c.name === city) ? city : ""}
                    onChange={(e) => {
                      if (e.target.value) applyCity(provinceDraft || province, e.target.value);
                    }}
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
              </label>
            </div>

            <p className="weather-picker-hint">
              {source === "geo" ? "当前来自定位" : source === "manual" ? "当前为手动选择" : "尚未选择城市"}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

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
