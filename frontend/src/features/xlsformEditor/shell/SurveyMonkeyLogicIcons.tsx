import type { SVGProps } from "react";

type SurveyMonkeyLogicIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  title?: string;
};

const strokeDefaults = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function iconA11y(title?: string) {
  return {
    role: title ? "img" : "presentation",
    "aria-hidden": title ? undefined : true,
    "aria-label": title,
  };
}

export function SurveyMonkeyAdvancedLogicIcon({
  size = 22,
  title,
  ...props
}: SurveyMonkeyLogicIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      {...iconA11y(title)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M14 44V29C14 16 23 8 36 8s15 9 15 22v16"
        {...strokeDefaults}
        strokeWidth="6.5"
      />
      <path d="m42 38 9 9 9-9" {...strokeDefaults} strokeWidth="6.5" />
      <circle cx="14" cy="44" r="8" fill="currentColor" />
      <circle cx="34" cy="44" r="6" fill="white" stroke="currentColor" strokeWidth="6.5" />
    </svg>
  );
}

export function SurveyMonkeyVisualLogicIcon({
  size = 22,
  title,
  ...props
}: SurveyMonkeyLogicIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      {...iconA11y(title)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="14" cy="18" r="6" {...strokeDefaults} strokeWidth="6" />
      <circle cx="14" cy="46" r="6" {...strokeDefaults} strokeWidth="6" />
      <path d="M19 22 32 32 19 42" {...strokeDefaults} strokeWidth="6" />
      <path d="M32 32h11" {...strokeDefaults} strokeWidth="6" />
      <path d="M43 20 59 32 43 44Z" {...strokeDefaults} strokeWidth="6" />
    </svg>
  );
}
