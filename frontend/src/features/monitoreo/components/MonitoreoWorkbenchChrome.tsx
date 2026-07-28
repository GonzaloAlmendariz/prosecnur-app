import { useEffect, useRef } from "react";
import type { MonitoreoWorkbenchChromeProps } from "./MonitoreoWorkbenchChrome.types";

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function MonitoreoWorkbenchChrome({
  seccionActiva,
  rail,
  head,
  children,
  clarity = null,
  status = null,
  isTerritorial = false,
  hasReportStatus = false,
  ariaLabel = "Mesa de trabajo de monitoreo",
  ariaLive = "off",
  className,
  mainClassName,
  contentClassName,
  contentId,
  contentRole,
  contentAriaLabelledBy,
  scrollResetKey,
}: MonitoreoWorkbenchChromeProps) {
  const resolvedContentId = contentId ?? `monitoreo-${seccionActiva}-panel`;
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Cambiar de pestaña deja el scroll donde estaba y aterrizas a media vista o
  // al pie de la siguiente. Volver arriba es parte de llegar a la vista nueva.
  useEffect(() => {
    if (scrollResetKey == null) return;
    const node = contentRef.current;
    if (!node) return;
    node.scrollTop = 0;
    node.querySelectorAll<HTMLElement>("[data-scroll-reset]").forEach((child) => {
      child.scrollTop = 0;
    });
  }, [scrollResetKey]);

  return (
    <section className={joinClasses("mon-workbench pulso-split-view pulso-context-tab-layout", className)} aria-label={ariaLabel}>
      {rail}
      <main
        data-qa-geometry-group="monitoring-workbench-rows"
        data-qa-geometry-contract="intrinsic"
        className={joinClasses(
          "mon-workbench-main pulso-content-area",
          isTerritorial && "is-territorial",
          hasReportStatus && "has-report-status",
          mainClassName,
        )}
        aria-live={ariaLive}
      >
        {head}
        {clarity}
        {status}
        <div
          ref={contentRef}
          data-qa-geometry-capacity="owned"
          id={resolvedContentId}
          role={contentRole}
          aria-labelledby={contentAriaLabelledBy}
          className={joinClasses(`mon-workbench-content mon-workbench-content--${seccionActiva}`, contentClassName)}
        >
          {children}
        </div>
      </main>
    </section>
  );
}
