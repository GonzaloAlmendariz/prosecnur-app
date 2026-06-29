import type { ReactNode } from "react";
import type { WorkbenchView } from "../core/monitoreoRegistry";

export type MonitoreoWorkbenchChromeProps = {
  activeView: WorkbenchView;
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
