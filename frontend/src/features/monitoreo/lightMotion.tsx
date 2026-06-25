import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

type MotionOnlyProps = {
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  variants?: unknown;
  layout?: unknown;
  layoutId?: unknown;
};

type MotionDivProps = HTMLAttributes<HTMLDivElement> & MotionOnlyProps;

const MotionDiv = forwardRef<HTMLDivElement, MotionDivProps>(function MotionDiv(
  {
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    variants: _variants,
    layout: _layout,
    layoutId: _layoutId,
    ...props
  },
  ref,
) {
  return <div ref={ref} {...props} />;
});

export const motion = {
  div: MotionDiv,
};

export function AnimatePresence({ children }: { children: ReactNode; initial?: boolean; mode?: string }) {
  return <>{children}</>;
}

export function useReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
