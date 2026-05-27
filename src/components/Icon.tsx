// CATCHPASS 아이콘 시스템 — Curved/Light(Border) + Curved/Bold 두 변종.
// border: 1.6px stroke, 둥근 join/cap, fill="none"
// bold: 동일 실루엣을 currentColor로 채움 (선형 아이콘은 stroke 굵기 증가)
//
// 사용 패턴: <Icon name="home" variant={active ? "bold" : "border"} size={22} />

import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "ticket"
  | "trophy"
  | "user"
  | "bell"
  | "search"
  | "pin"
  | "chevron-down"
  | "chevron-up"
  | "chevron-left"
  | "chevron-right"
  | "list"
  | "grid"
  | "x"
  | "plus"
  | "check"
  | "lock"
  | "arrow-right"
  | "camera"
  | "clipboard"
  | "store";

export type IconVariant = "border" | "bold";

interface Props extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  variant?: IconVariant;
  size?: number;
}

const SW_BORDER = 1.6;
const SW_BOLD = 2.4;

// Outline (border) path data — reused by both variants where silhouette matches.
const PATHS: Record<IconName, string> = {
  home: "M3.5 11.2L12 4l8.5 7.2V19a2 2 0 0 1-2 2h-3.5v-5.6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1V21H5.5a2 2 0 0 1-2-2v-7.8Z",
  ticket:
    "M3 9.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V11a1.2 1.2 0 0 0 0 4v1.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V15a1.2 1.2 0 0 0 0-4V9.5Z",
  trophy:
    "M7 4h10v3.5a5 5 0 1 1-10 0V4ZM7 4H4.5C4.5 6 5 8 7.2 8M17 4h2.5C19.5 6 19 8 16.8 8M10 14v3h4v-3M8 21h8",
  user:
    "M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c0-3.5 3.5-6 7.5-6s7.5 2.5 7.5 6",
  bell:
    "M18.5 16.5c-1.2-1-2-2.5-2-4.5V10a4.5 4.5 0 0 0-9 0v2c0 2-.8 3.5-2 4.5h13ZM10.5 20a2 2 0 0 0 3 0",
  search:
    "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16.2 16.2L20.5 20.5",
  pin: "M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12ZM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  "chevron-down": "M6 9.5l6 6 6-6",
  "chevron-up": "M6 14.5l6-6 6 6",
  "chevron-left": "M14.5 6l-6 6 6 6",
  "chevron-right": "M9.5 6l6 6-6 6",
  list: "M8 6h13M8 12h13M8 18h13M4 6h.5M4 12h.5M4 18h.5",
  grid:
    "M4 5.5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 8.5 10h-3A1.5 1.5 0 0 1 4 8.5v-3ZM14 5.5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3ZM4 15.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 10 15.5v3A1.5 1.5 0 0 1 8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3ZM14 15.5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3Z",
  x: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l5 5L20 7",
  lock:
    "M5 11h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9ZM8 11V8a4 4 0 0 1 8 0v3",
  "arrow-right": "M5 12h14M13 5l7 7-7 7",
  camera:
    "M3 8.5a2 2 0 0 1 2-2h2l1.2-2h7.6L17 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9ZM12 16.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  clipboard:
    "M9 5h6a1 1 0 0 1 1 1v1H8V6a1 1 0 0 1 1-1ZM6 7h12v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7ZM9 12h6M9 16h4",
  store:
    "M4.5 9.5h15v9.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V9.5ZM4 9.5L5.5 5h13L20 9.5M10 21v-5h4v5",
};

// 아이콘 별로 bold 모드에서 fill을 쓸지(닫힌 형태) stroke만 굵게 쓸지(선형) 결정.
const FILLED_BOLD: Partial<Record<IconName, boolean>> = {
  home: true,
  ticket: true,
  trophy: true,
  user: true,
  bell: true,
  pin: true,
  grid: true,
  lock: true,
  camera: true,
  clipboard: true,
  store: true,
};

export default function Icon({ name, variant = "border", size = 22, className, ...rest }: Props) {
  const d = PATHS[name];
  const useFill = variant === "bold" && FILLED_BOLD[name];

  if (useFill) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
        {...rest}
      >
        <path d={d} />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={variant === "bold" ? SW_BOLD : SW_BORDER}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
