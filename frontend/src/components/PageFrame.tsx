import { useLayoutEffect, useRef, type ReactNode } from "react";

const PAGE_MOTION_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

type PageFrameProps = {
  title: ReactNode;
  lead?: ReactNode;
  meta?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  layout?: "document" | "workbench" | "canvas" | "data";
  scrollOwner?: "page" | "body" | "panels";
  bodyMode?: "scroll" | "fill";
  headerMode?: "visible" | "sr-only";
  className?: string;
  resetScrollKey?: unknown;
  density?: "normal" | "compact";
};

export function PageFrame({
  title,
  lead,
  meta,
  toolbar,
  children,
  layout = "document",
  scrollOwner,
  bodyMode = "scroll",
  headerMode = "visible",
  className,
  resetScrollKey,
  density = "normal",
}: PageFrameProps) {
  const headerRef = useRef<HTMLElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const previousResetKeyRef = useRef(resetScrollKey);
  const resolvedScrollOwner = scrollOwner ?? (bodyMode === "fill" ? "panels" : "page");
  const classes = [
    "pulso-page-frame",
    `pulso-page-frame--${density}`,
    `pulso-page-frame--layout-${layout}`,
    `pulso-page-frame--scroll-${resolvedScrollOwner}`,
    className,
  ].filter(Boolean).join(" ");

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = 0;
    body.scrollLeft = 0;

    const previousResetKey = previousResetKeyRef.current;
    previousResetKeyRef.current = resetScrollKey;
    if (
      resetScrollKey === undefined ||
      Object.is(previousResetKey, resetScrollKey) ||
      prefersReducedMotion()
    ) {
      return;
    }

    const bodyAnimation = body.animate(
      [
        { opacity: 0, transform: "translateY(8px) scale(0.997)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      { duration: 190, easing: PAGE_MOTION_EASE, fill: "both" },
    );

    const headerAnimation = headerRef.current?.animate(
      [
        { opacity: 0.74, transform: "translateY(-3px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 150, easing: PAGE_MOTION_EASE, fill: "both" },
    );

    const toolbarAnimation = toolbarRef.current?.animate(
      [
        { opacity: 0.82, transform: "translateY(-2px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 160, easing: PAGE_MOTION_EASE, fill: "both" },
    );

    return () => {
      bodyAnimation.cancel();
      headerAnimation?.cancel();
      toolbarAnimation?.cancel();
    };
  }, [resetScrollKey]);

  return (
    <section className={classes}>
      {headerMode === "sr-only" ? (
        <header ref={headerRef} className="pulso-sr-only">
          <h1>{title}</h1>
        </header>
      ) : (
        <header ref={headerRef} className="pulso-page-frame-header">
          <div className="pulso-page-frame-heading">
            <h1 className="pulso-page-frame-title">{title}</h1>
            {lead && <p className="pulso-page-frame-lead">{lead}</p>}
          </div>
          {meta && <div className="pulso-page-frame-meta">{meta}</div>}
        </header>
      )}

      {toolbar && <div ref={toolbarRef} className="pulso-page-frame-toolbar">{toolbar}</div>}

      <div
        ref={bodyRef}
        className={`pulso-page-frame-body pulso-page-frame-body--${bodyMode}`}
      >
        {children}
      </div>
    </section>
  );
}
