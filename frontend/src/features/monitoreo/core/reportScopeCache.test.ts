import { describe, expect, it } from "vitest";
import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../api/client";
import { MonitoreoScopeCache } from "./reportScopeCache";

function territorialState(scope: MonitoreoTerritorialDashboard["report_scope"]): MonitoreoState {
  const reports = {
    schema: "test",
    report_scope: scope,
    generated_at: "2026-06-24T00:00:00Z",
    active_route_phase: "field",
    phase_note: "",
    kpis: {
      total: 10,
      valid: 8,
      invalid: 2,
      target: 20,
      total_respuestas: 10,
      consentidas: 10,
      validas: 8,
      revision: 1,
      no_defendibles: 1,
      meta: 20,
      avance_pct: 40,
      ritmo_diario: null,
      gps_crossable: 8,
      geo_ok: 6,
      geo_cerca: 1,
      geo_revision: 1,
      geo_no_defendible: 0,
      geo_sin_cruce: 0,
      duration_median: 12,
      duration_p95: 20,
      inconsistencies: 0,
    },
    source_coherence: {
      asset_uid: "asset-field",
      asset_name: "Campo",
      version_id: "v1",
      deployment_active: true,
      district_field: "",
      district_list_name: "",
      district_choices: [],
      detected_fields: {},
      drift: [],
    },
    source_validity: {
      field: "",
      values: [],
      effective_count: 8,
      non_effective_count: 2,
      missing_count: 0,
      total_responses: 10,
      options: [],
    },
    district_progress: [],
    block_progress: [],
    response_audit: [],
    team: [],
    daily: [],
    map: { phase: "field", blocks: [], points: [], alerts: [], legend: [] },
    internal_queries: {
      incomplete_blocks: [],
      far_gps: [],
      lagging_districts: [],
    },
  } as MonitoreoTerritorialDashboard;

  return {
    ok: true,
    sources: [],
    config: {
      monitoreo_profile: { family: "territorial" },
      territorial: {
        active_route_phase: "field",
        asset_uid: "asset-field",
        source_id: "source-field",
        phase_sources: {
          field: {
            asset_uid: "asset-field",
            source_id: "source-field",
            kobo_version_id: "v1",
            kobo_asset_name: "Campo",
            inspected_at: "",
          },
          pilot: {
            asset_uid: "asset-pilot",
            source_id: "source-pilot",
            kobo_version_id: "v1",
            kobo_asset_name: "Piloto",
            inspected_at: "",
          },
        },
      },
    } as MonitoreoState["config"],
    has_snapshot: true,
    synced_at: "",
    n_rows: 10,
    variables: [],
    dashboard: {
      ok: true,
      kpis: {
        total: 10,
        valid: 8,
        invalid: 2,
        target: 20,
        avance_pct: 40,
        ritmo_diario: null,
        duration_median: 12,
        duration_p95: 20,
        inconsistencies: 0,
      },
      progress: [],
      production: [],
      inconsistencies: [],
      territorial_reports: reports,
    },
    acreditacion: {} as MonitoreoState["acreditacion"],
    errors: [],
  };
}

function pilotState(scope: MonitoreoTerritorialDashboard["report_scope"]): MonitoreoState {
  const state = territorialState(scope);
  const reports = state.dashboard?.territorial_reports;
  if (reports) reports.active_route_phase = "pilot";
  if (state.config?.territorial) state.config.territorial.active_route_phase = "pilot";
  return state;
}

describe("MonitoreoScopeCache", () => {
  it("keeps background queries from replacing the active advance scope", () => {
    const cache = new MonitoreoScopeCache();
    cache.putTerritorialState(territorialState("advance_summary"));
    cache.putTerritorialState(territorialState("queries_summary"));

    expect(cache.findTerritorialForView({
      phase: "field",
      source: "source-field",
      view: "avance",
      preferredScope: "advance_summary",
    })?.reports.report_scope).toBe("advance_summary");
    expect(cache.findTerritorialForView({
      phase: "field",
      source: "source-field",
      view: "consultas",
      preferredScope: "queries_summary",
    })?.reports.report_scope).toBe("queries_summary");
  });

  it("invalidates only the mutated phase+source and keeps the other phase warm", () => {
    const cache = new MonitoreoScopeCache();
    cache.putTerritorialState(territorialState("advance_summary"));
    cache.putTerritorialState(territorialState("queries_summary"));
    cache.putTerritorialState(pilotState("advance_summary"));

    cache.invalidateTerritorial({ phase: "field", source: "source-field" });

    expect(cache.getTerritorial({ phase: "field", source: "source-field", scope: "advance_summary" })).toBeNull();
    expect(cache.getTerritorial({ phase: "field", source: "source-field", scope: "queries_summary" })).toBeNull();
    expect(cache.getTerritorial({ phase: "pilot", source: "source-pilot", scope: "advance_summary" })?.reports.report_scope)
      .toBe("advance_summary");
  });

  it("drops the full-scope aliases when invalidating a phase+source", () => {
    const cache = new MonitoreoScopeCache();
    cache.putTerritorialState(territorialState("full"));
    expect(cache.getTerritorial({ phase: "field", source: "source-field", scope: "advance_summary" })).not.toBeNull();

    cache.invalidateTerritorial({ phase: "field", source: "source-field" });

    expect(cache.getTerritorial({ phase: "field", source: "source-field", scope: "full" })).toBeNull();
    expect(cache.getTerritorial({ phase: "field", source: "source-field", scope: "advance_summary" })).toBeNull();
    expect(cache.getTerritorial({ phase: "field", source: "source-field", scope: "validation_summary" })).toBeNull();
  });
});
