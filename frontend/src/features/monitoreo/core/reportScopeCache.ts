import type {
  MonitoreoState,
  MonitoreoTerritorialDashboard,
  MonitoreoTerritorialReportCacheMeta,
} from "../../../api/client";
import type { MonitoreoFamilyId, MonitoreoReportScope } from "../profiles/types";

export type MonitoreoScopeCacheKey = {
  family: MonitoreoFamilyId;
  phase?: string;
  source?: string;
  scope: MonitoreoReportScope;
};

export type MonitoreoScopeCacheEntry = {
  key: string;
  reports: MonitoreoTerritorialDashboard;
  meta?: MonitoreoTerritorialReportCacheMeta | null;
  storedAt: number;
};

export function monitoreoScopeCacheKey(input: MonitoreoScopeCacheKey) {
  return [
    input.family,
    input.phase || "default",
    input.source || "sin-fuente",
    input.scope,
  ].join("|");
}

export function territorialSourceKeyFromState(state: MonitoreoState, phase: string) {
  const territorial = state.config?.territorial;
  const source = territorial?.phase_sources?.[phase as "pilot" | "field"];
  return source?.source_id || source?.asset_uid || territorial?.source_id || territorial?.asset_uid || "sin-fuente";
}

export function territorialSourceKeyFromReports(reports: MonitoreoTerritorialDashboard) {
  return reports.source_coherence?.asset_uid || "sin-fuente";
}

export function reportScopesForTerritorialView(view: string): MonitoreoReportScope[] {
  if (view === "fuentes") return ["source", "full"];
  if (view === "modelo") return ["route_summary", "advance_summary", "validation_summary", "full"];
  if (view === "avance") return ["advance_summary", "validation_summary", "full"];
  if (view === "calidad") return ["validation_summary", "full"];
  if (view === "consultas" || view === "ocurrencias") return ["queries_summary", "full"];
  return ["full"];
}

export function territorialReportsCoverView(
  reports: MonitoreoTerritorialDashboard | null | undefined,
  view: string,
) {
  if (!reports) return false;
  const scope = (reports.report_scope || "full") as MonitoreoReportScope;
  return reportScopesForTerritorialView(view).includes(scope);
}

export class MonitoreoScopeCache {
  private entries = new Map<string, MonitoreoScopeCacheEntry>();

  putTerritorialState(state: MonitoreoState) {
    const reports = state.dashboard?.territorial_reports ?? null;
    if (!reports) return null;
    const phase = reports.active_route_phase || state.config?.territorial?.active_route_phase || "field";
    const source = territorialSourceKeyFromState(state, phase) || territorialSourceKeyFromReports(reports);
    const scope = (reports.report_scope || "full") as MonitoreoReportScope;
    const key = monitoreoScopeCacheKey({ family: "territorial", phase, source, scope });
    const entry = {
      key,
      reports,
      meta: state.territorial_report_cache ?? null,
      storedAt: Date.now(),
    };
    this.entries.set(key, entry);
    if (scope === "full") {
      for (const alias of ["source", "route_summary", "advance_summary", "validation_summary", "queries_summary"] as MonitoreoReportScope[]) {
        this.entries.set(monitoreoScopeCacheKey({ family: "territorial", phase, source, scope: alias }), entry);
      }
    }
    return entry;
  }

  getTerritorial(input: { phase: string; source: string; scope: MonitoreoReportScope }) {
    return this.entries.get(monitoreoScopeCacheKey({ family: "territorial", ...input })) ?? null;
  }

  findTerritorialForView(input: { phase: string; source: string; view: string; preferredScope?: MonitoreoReportScope }) {
    const scopes = [
      ...(input.preferredScope ? [input.preferredScope] : []),
      ...reportScopesForTerritorialView(input.view),
    ].filter((scope, index, all) => all.indexOf(scope) === index);
    for (const scope of scopes) {
      const entry = this.getTerritorial({ phase: input.phase, source: input.source, scope });
      if (entry && territorialReportsCoverView(entry.reports, input.view)) return entry;
    }
    return null;
  }

  clear() {
    this.entries.clear();
  }
}

export const monitoreoScopeCache = new MonitoreoScopeCache();
