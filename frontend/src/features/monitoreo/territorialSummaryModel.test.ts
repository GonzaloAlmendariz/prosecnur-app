import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard } from "../../api/client";
import {
  buildTerritorialExecutiveSummary,
  buildTerritorialPriorityGroups,
  territorialDistrictActionKey,
  territorialUmpAction,
  type TerritorialSummaryDistrictRow,
  type TerritorialSummaryUmpRow,
} from "./territorialSummaryModel";

function makeReports(overrides: Partial<MonitoreoTerritorialDashboard> = {}): MonitoreoTerritorialDashboard {
  return {
    schema: "monitoreo_territorial_dashboard_v1",
    generated_at: "2026-06-17T10:20:00-05:00",
    active_route_phase: "field",
    phase_note: "",
    kpis: {
      total_respuestas: 0,
      consentidas: 0,
      validas: 0,
      revision: 0,
      no_defendibles: 0,
      meta: 1200,
      avance_pct: 0,
      gps_crossable: 0,
      geo_ok: 0,
      geo_cerca: 0,
      geo_revision: 0,
      geo_no_defendible: 0,
      geo_sin_cruce: 0,
      duration_median: null,
      duration_p95: null,
    },
    source_coherence: {
      asset_uid: "",
      asset_name: "",
      version_id: "",
      deployment_active: null,
      district_field: "",
      district_list_name: "",
      district_choices: [],
      detected_fields: {},
      drift: [],
    },
    source_validity: {
      field: "",
      values: [],
      effective_count: null,
      non_effective_count: null,
      missing_count: null,
      total_responses: 0,
      options: [],
    },
    route_quota_progress: {
      schema: "monitoreo_territorial_quota_progress_v3",
      configured: true,
      variables: {
        age_var: "Core/E1_age",
        sex_var: "Core/E2_sex",
        age_available: true,
        sex_available: true,
      },
      blocks: [],
      districts: [
        {
          ubigeo: "150132",
          distrito: "SAN JUAN DE LURIGANCHO",
          configured: true,
          status: "in_field",
          target: 16,
          validas: 2,
          missing_total: 14,
          sex: [
            { label: "Hombre", target: 8, achieved: 1, missing: 7 },
            { label: "Mujer", target: 8, achieved: 1, missing: 7 },
          ],
          age: [
            { label: "18-29", target: 8, achieved: 1, missing: 7 },
            { label: "30-44", target: 8, achieved: 1, missing: 7 },
          ],
          missing: [],
        },
      ],
    },
    route_quota_marginals: { blocks: [] },
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
    ...overrides,
  };
}

function district(overrides: Partial<TerritorialSummaryDistrictRow>): TerritorialSummaryDistrictRow {
  return {
    ubigeo: "150132",
    distrito: "SAN JUAN DE LURIGANCHO",
    meta: 400,
    total: 100,
    validas: 100,
    revision: 0,
    no_defendibles: 0,
    avance_pct: 25,
    brecha: 300,
    ump_complete: 1,
    ump_started_incomplete: 2,
    ump_overfilled: 0,
    ump_no_progress: 1,
    ...overrides,
  };
}

function ump(overrides: Partial<TerritorialSummaryUmpRow>): TerritorialSummaryUmpRow {
  return {
    key: "ump-1",
    district: "SAN JUAN DE LURIGANCHO",
    ubigeo: "150132",
    ump: "UMP 1",
    blockLabel: "Mz 0590",
    zone: "10700",
    valid: 4,
    target: 8,
    gap: 4,
    progressPct: 50,
    status: "incomplete",
    responsible: "Equipo Norte",
    ...overrides,
  };
}

describe("territorialSummaryModel", () => {
  it("uses normalized route quota progress distributions when audit rows are absent", () => {
    const summary = buildTerritorialExecutiveSummary({
      reports: makeReports(),
      districtRows: [],
      umpRows: [],
    });

    expect(summary.effectiveResponses).toBe(2);
    expect(summary.sex.total).toBe(2);
    expect(summary.sex.items.find((item) => item.label === "Hombre")?.value).toBe(1);
    expect(summary.sex.items.find((item) => item.label === "Mujer")?.value).toBe(1);
    expect(summary.age.total).toBe(2);
    expect(summary.age.items.find((item) => item.label === "18-29")?.value).toBe(1);
    expect(summary.age.items.find((item) => item.label === "30-44")?.value).toBe(1);
  });

  it("prefers quota distribution rows that match the advance KPI", () => {
    const base = makeReports();
    const baseQuota = base.route_quota_progress!;
    const baseDistrict = baseQuota.districts![0]!;
    const summary = buildTerritorialExecutiveSummary({
      reports: {
        ...base,
        kpis: {
          ...base.kpis,
          validas: 3,
        },
        route_quota_progress: {
          ...baseQuota,
          districts: [
            {
              ...baseDistrict,
              validas: 4,
              sex: [
                { label: "Hombre", target: 2, achieved: 2, missing: 0 },
                { label: "Mujer", target: 2, achieved: 2, missing: 0 },
              ],
              age: [
                { label: "18-29", target: 2, achieved: 2, missing: 0 },
                { label: "30-44", target: 2, achieved: 2, missing: 0 },
              ],
            },
          ],
          blocks: [
            {
              id_manzana: "150132-001",
              ubigeo: baseDistrict.ubigeo,
              distrito: "SAN JUAN DE LURIGANCHO",
              zona: "10700",
              manzana: "001",
              tipo_manzana: "titular",
              ump: 1,
              configured: true,
              status: "in_field",
              target: 8,
              validas: 3,
              missing_total: 5,
              sex: [
                { label: "Hombre", target: 2, achieved: 1, missing: 1 },
                { label: "Mujer", target: 2, achieved: 2, missing: 0 },
              ],
              age: [
                { label: "18-29", target: 2, achieved: 1, missing: 1 },
                { label: "30-44", target: 2, achieved: 2, missing: 0 },
              ],
              cross: [],
              missing: [],
            },
          ],
        },
      },
      districtRows: [],
      umpRows: [],
    });

    expect(summary.effectiveResponses).toBe(3);
    expect(summary.sex.total).toBe(3);
    expect(summary.sex.items.find((item) => item.label === "Hombre")?.value).toBe(1);
    expect(summary.sex.items.find((item) => item.label === "Mujer")?.value).toBe(2);
    expect(summary.age.total).toBe(3);
  });

  it("builds sex and age distributions only from advance-valid responses", () => {
    const summary = buildTerritorialExecutiveSummary({
      reports: makeReports({
        response_audit: [
          { row_index: 1, response_id: "r1", advance_valid: true, sex: "hombre", age: 22 },
          { row_index: 2, response_id: "r2", advance_valid: true, sex: "mujer", age: 38 },
          { row_index: 3, response_id: "r3", advance_valid: false, sex: "mujer", age: 39 },
        ] as MonitoreoTerritorialDashboard["response_audit"],
      }),
      districtRows: [],
      umpRows: [],
    });

    expect(summary.effectiveResponses).toBe(2);
    expect(summary.sex.items.find((item) => item.label === "Hombre")?.value).toBe(1);
    expect(summary.sex.items.find((item) => item.label === "Mujer")?.value).toBe(1);
    expect(summary.age.items.find((item) => item.label === "18-29")?.value).toBe(1);
    expect(summary.age.items.find((item) => item.label === "30-44")?.value).toBe(1);
  });

  it("returns explicit missing variable and missing age-range states", () => {
    const missingSex = buildTerritorialExecutiveSummary({
      reports: makeReports({
        route_quota_progress: {
          schema: "monitoreo_territorial_quota_progress_v3",
          configured: true,
          variables: { age_var: "edad", sex_var: "", age_available: true, sex_available: false },
          blocks: [],
          districts: [],
        },
      }),
      districtRows: [],
      umpRows: [],
    });
    expect(missingSex.sex.status).toBe("missing_variable");
    expect(missingSex.sex.message).toBe("Variable de sexo no configurada");

    const missingAgeRanges = buildTerritorialExecutiveSummary({
      reports: makeReports({
        route_quota_progress: {
          schema: "monitoreo_territorial_quota_progress_v3",
          configured: true,
          variables: { age_var: "edad", sex_var: "sexo", age_available: true, sex_available: true },
          blocks: [],
          districts: [],
        },
      }),
      districtRows: [],
      umpRows: [],
    });
    expect(missingAgeRanges.age.status).toBe("missing_ranges");
    expect(missingAgeRanges.age.message).toBe("Rangos de edad no configurados");
  });

  it("treats UMP above quota as complete information, not as a priority problem", () => {
    const summary = buildTerritorialExecutiveSummary({
      reports: makeReports(),
      districtRows: [],
      umpRows: [
        ump({ key: "complete", status: "complete", valid: 8, gap: 0 }),
        ump({ key: "over", status: "complete", valid: 10, gap: 0 }),
        ump({ key: "incomplete", status: "incomplete", valid: 4, gap: 4 }),
        ump({ key: "none", status: "none", valid: 0, gap: 8 }),
      ],
    });

    expect(summary.ump.fulfilled).toBe(2);
    expect(summary.priorities.flatMap((group) => group.items).map((item) => item.key)).not.toContain("ump:over");
  });

  it("orders priority groups and exposes navigation keys", () => {
    const groups = buildTerritorialPriorityGroups(
      [
        district({ ubigeo: "150132", distrito: "SAN JUAN DE LURIGANCHO", avance_pct: 40, brecha: 80 }),
        district({ ubigeo: "150140", distrito: "SANTIAGO DE SURCO", avance_pct: 10, brecha: 120 }),
      ],
      [
        ump({ key: "far", status: "incomplete", valid: 2, gap: 6, progressPct: 25 }),
        ump({ key: "near", status: "incomplete", valid: 7, gap: 1, progressPct: 88 }),
        ump({ key: "empty", status: "none", valid: 0, gap: 8, progressPct: 0 }),
      ],
    );

    expect(groups.find((group) => group.key === "districts")?.items[0].action).toEqual({ type: "district", districtKey: "150140" });
    expect(groups.find((group) => group.key === "incomplete")?.items[0].action).toEqual({ type: "ump", districtKey: "150132", umpKey: "far" });
    expect(groups.find((group) => group.key === "near_complete")?.items[0].action).toEqual({ type: "ump", districtKey: "150132", umpKey: "near" });
    expect(territorialDistrictActionKey(district({ ubigeo: "150108", distrito: "CHORRILLOS" }))).toBe("150108");
    expect(territorialUmpAction(ump({ key: "ump:150108:1", ubigeo: "150108" }))).toEqual({ type: "ump", districtKey: "150108", umpKey: "ump:150108:1" });
  });
});
