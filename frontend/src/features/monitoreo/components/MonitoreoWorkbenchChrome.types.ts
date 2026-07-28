import type { ReactNode } from "react";
import type { MonitoreoSeccion } from "../core/monitoreoRegistry";

export type MonitoreoWorkbenchChromeProps = {
  seccionActiva: MonitoreoSeccion;
  rail: ReactNode;
  head: ReactNode;
  children: ReactNode;
  clarity?: ReactNode;
  status?: ReactNode;
  isTerritorial?: boolean;
  hasReportStatus?: boolean;
  ariaLabel?: string;
  ariaLive?: "off" | "polite" | "assertive";
  className?: string;
  mainClassName?: string;
  contentClassName?: string;
  contentId?: string;
  contentRole?: "tabpanel";
  contentAriaLabelledBy?: string;
  /**
   * Cambia cuando cambia la vista (sección o pestaña) y el contenido debe
   * volver arriba. Sin esto se aterriza al pie de la pestaña nueva, con los
   * títulos ya tapados por la banda sticky.
   */
  scrollResetKey?: string;
};
