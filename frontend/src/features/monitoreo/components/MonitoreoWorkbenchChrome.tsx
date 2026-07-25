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
  ariaLive = "polite",
  className,
  mainClassName,
  contentClassName,
}: MonitoreoWorkbenchChromeProps) {
  return (
    <section className={joinClasses("mon-workbench pulso-split-view", className)} aria-label={ariaLabel}>
      {rail}
      <main
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
        <div className={joinClasses(`mon-workbench-content mon-workbench-content--${seccionActiva}`, contentClassName)}>
          {children}
        </div>
      </main>
    </section>
  );
}
