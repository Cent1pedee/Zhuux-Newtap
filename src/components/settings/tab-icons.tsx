/**
 * 设置页签图标（内联 SVG，零请求）。
 * 统一 14×14 视口与 1.8 描边，跟页面上其他线性图标是同一套笔触。
 */

function iconProps() {
  return {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function IconSearch() {
  return (
    <svg {...iconProps()}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconPalette() {
  return (
    <svg {...iconProps()}>
      <path d="M12 21a9 9 0 1 1 9-9c0 2-1.6 3-3 3h-1.5a2 2 0 0 0-1.4 3.4A2 2 0 0 1 12 21Z" />
      <circle cx="8" cy="10" r="1.2" />
      <circle cx="12" cy="7.5" r="1.2" />
      <circle cx="15.8" cy="10" r="1.2" />
    </svg>
  );
}

export function IconGrid() {
  return (
    <svg {...iconProps()}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}

export function IconLayers() {
  return (
    <svg {...iconProps()}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

export function IconImage() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </svg>
  );
}

export function IconShield() {
  return (
    <svg {...iconProps()}>
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.7-7 9.5-4.1-1.8-7-5.3-7-9.5V6l7-3Z" />
      <path d="m9.5 12 1.8 1.8L15 10" />
    </svg>
  );
}

export function IconInfo() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h0" />
    </svg>
  );
}
