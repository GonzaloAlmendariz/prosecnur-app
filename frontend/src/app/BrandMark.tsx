import type { SVGProps } from "react";

export function BrandMark({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={["pulso-brand-mark", className].filter(Boolean).join(" ")}
      width="28"
      height="28"
      viewBox="0 0 64 64"
      aria-hidden="true"
      {...props}
    >
      <rect width="64" height="64" rx="15.4" fill="var(--pulso-primary)" />
      <rect x="12" y="30" width="7" height="18" rx="3.5" fill="white" />
      <rect x="23" y="22" width="7" height="26" rx="3.5" fill="white" />
      <rect x="34" y="28" width="7" height="20" rx="3.5" fill="white" />
      <rect x="45" y="16" width="7" height="32" rx="3.5" fill="white" />
    </svg>
  );
}
