import type { ComponentType } from "react";
import type { MonitoreoSeccion } from "../core/monitoreoRegistry";

export type MonitoreoFamilyId = "acreditacion" | "territorial" | "aulas_universitarias" | "telefonico";

export type MonitoreoReportScope =
  | "source"
  | "route_summary"
  | "advance_summary"
  | "validation_summary"
  | "queries_summary"
  | "phone_summary"
  | "full";

export type MonitoreoFamilyModule = {
  family: MonitoreoFamilyId;
  chunk: string;
  label: string;
  views: readonly MonitoreoSeccion[];
  loadPage: () => Promise<{ default: ComponentType }>;
  warmupScopes: readonly MonitoreoReportScope[];
  reportScopes?: Partial<Record<MonitoreoSeccion, MonitoreoReportScope>>;
};
