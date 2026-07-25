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
};
