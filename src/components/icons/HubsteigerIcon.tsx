import type { IconProps } from "./types";

export function HubsteigerIcon({ size = 24, strokeWidth = 1.8, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M2.8 14.7h7.9l1.2 2.8H3.7a.9.9 0 0 1-.9-.9v-1.9Z" />
      <path d="M10.7 14.7h3.7a1 1 0 0 1 .9.6l.9 2.2h-4.3l-1.2-2.8Z" />
      <path d="M4.2 14.7 5.5 12h3.2l1.2 2.7" />
      <path d="M5.5 12v2.7" />
      <path d="M8.7 12v2.7" />
      <circle cx="9.5" cy="13.3" r=".7" />
      <path d="M9.9 12.8 14.5 8" />
      <path d="M11 13.8 15.6 9" />
      <circle cx="15.2" cy="8.5" r=".55" />
      <path d="M15.7 8.1 18 6.7" />
      <path d="M16.3 9.2 18.4 8" />
      <path d="M18 5.7h3.2v3.1H18z" />
      <path d="M18 6.8h3.2" />
      <path d="M19.1 5.7v3.1" />
      <path d="M4.9 17.5 4 19.2" />
      <path d="M14.9 17.5 16 19.2" />
      <circle cx="6.1" cy="18.4" r="1.15" />
      <circle cx="13.8" cy="18.4" r="1.15" />
    </svg>
  );
}
