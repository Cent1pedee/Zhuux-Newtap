"use client";

/**
 * Magic UI · Moving Border
 * 用 conic-gradient 旋转描边；内层用背景色盖住中间，只留 1px 边框光。
 * reduce 时退化为静态细边框。
 */
export function MovingBorder({
  children,
  reduce = false,
  className = "",
  radius = 18,
  duration = 6,
}: {
  children: React.ReactNode;
  reduce?: boolean;
  className?: string;
  radius?: number;
  duration?: number;
}) {
  return (
    <div className={`moving-border relative ${className}`} style={{ borderRadius: radius }}>
      {reduce ? null : (
        <span
          className="moving-border-ring"
          aria-hidden="true"
          style={{ animationDuration: `${duration}s`, borderRadius: radius }}
        />
      )}
      <div className="moving-border-inner relative" style={{ borderRadius: radius }}>
        {children}
      </div>
    </div>
  );
}
