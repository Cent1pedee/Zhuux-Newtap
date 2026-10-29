"use client";

/**
 * Magic UI · Ripple
 *
 * 从中心向外层层扩散的圆环，每环错开延迟，形成持续的水波涟漪。
 * 纯 CSS 环形描边 + scale/opacity 动画，零图片、零请求。
 *
 * - 颜色取 --accent，描边不透明度 0.5 起（保证可辨识）
 * - 叠加一层径向辉光作为底色，避免只有细线时「太淡看不出」
 * - reduce 时保留静态圆环（不扩散），仍有构图而非一片空白
 */
export function Ripple({
  className = "",
  rings = 6,
  reduce = false,
}: {
  className?: string;
  rings?: number;
  reduce?: boolean;
}) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className="ripple-glow" />
      <div className="ripple-stage">
        {Array.from({ length: rings }, (_, i) => (
          <span
            key={i}
            className="ripple-ring"
            style={{
              // 每环延迟错开，形成连续波纹；reduce 时把动画停在第 0 帧
              animationDelay: `${(i * 3.2) / rings}s`,
              animationDuration: reduce ? undefined : "3.2s",
              animationPlayState: reduce ? "paused" : "running",
              opacity: reduce ? 0.16 + i * 0.03 : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
