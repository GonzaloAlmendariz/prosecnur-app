import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard, TerritorialBlockProgress, TerritorialResponseAuditRow } from "../../api/client";
import {
  buildTerritorialUmpCaseAudit,
  buildTerritorialUmpResponseReconciliation,
} from "./territorialCaseAuditModel";

function makeBlock(overrides: Partial<TerritorialBlockProgress>): TerritorialBlockProgress {
  return {
    id_manzana: "150108016000580",
    ubigeo: "150108",
    distrito: "CHORRILLOS",
    zona: "01600",
    manzana: "0580",
    tipo_manzana: "titular",
    territorio_muestral: "150108-01600",
    orden_seleccion: 38,
    hoja_num: 38,
    rango_inicio: 297,
    rango_fin: 304,
    entrevistas: 8,
    medida_tamano: null,
    lat: null,
    lon: null,
    ump: "38",
    meta: 8,
    validas: 7,
    revision: 0,
    no_defendibles: 0,
    avance_pct: 87.5,
    brecha: 1,
    ...overrides,
  };
}

function makeRow(overrides: Partial<TerritorialResponseAuditRow>): TerritorialResponseAuditRow {
  return {
    row_index: 1,
    response_id: "row",
    district_code: "150108",
    distrito: "CHORRILLOS",
    ubigeo: "150108",
    consent: "si",
    age: 21,
    sex: "hombre",
    status: "validada",
    submitted_by: "P524",
    pulso_code: "P524",
    pulso_code_raw: "P524",
    pulso_code_normalized: "P524",
    enumerator_assigned: "P524",
    submission_time: "2026-06-15T16:12:00-05:00",
    submission_date_iso: "2026-06-15",
    submission_date: "2026-06-15",
    submission_hour: "16:12",
    submission_datetime: "2026-06-15T16:12:00-05:00",
    duration_seconds: 900,
    lat: -12.18,
    lon: -77.02,
    gps_parseable: true,
    geo_estado: "geo_ok",
    distance_m: 0,
    nearest_block_id: "150108016000580",
    nearest_block_type: "titular",
    declared_ump_raw: "38",
    declared_ump_normalized: "38",
    advance_block_id: "150108016000580",
    advance_block_ump: "38",
    advance_block_ubigeo: "150108",
    advance_block_distrito: "CHORRILLOS",
    advance_block_zona: "01600",
    advance_block_manzana: "0580",
    advance_block_type: "titular",
    advance_block_match: true,
    advance_block_match_status: "recognized",
    advance_valid: true,
    advance_status: "validada",
    validation_status: "validada",
    source_effective: true,
    issues: "",
    ...overrides,
  };
}

function makeReports(rows: TerritorialResponseAuditRow[], blocks: TerritorialBlockProgress[]): MonitoreoTerritorialDashboard {
  return {
    active_route_phase: "field",
    response_audit: rows,
    block_progress: blocks,
    map: {
      blocks,
      points: rows.map((row) => ({
        response_id: row.response_id,
        submitted_by: row.submitted_by,
        pulso_code: row.pulso_code,
        pulso_code_raw: row.pulso_code_raw,
        pulso_code_normalized: row.pulso_code_normalized,
        enumerator_assigned: row.enumerator_assigned,
        responsible_display: row.responsible_display,
        submission_date_iso: row.submission_date_iso,
        submission_date: row.submission_date,
        submission_hour: row.submission_hour,
        submission_datetime: row.submission_datetime,
        ubigeo: row.ubigeo,
        distrito: row.distrito,
        age: row.age,
        sex: row.sex,
        lat: row.lat,
        lon: row.lon,
        gps_parseable: row.gps_parseable,
        geo_estado: row.geo_estado,
        distance_m: row.distance_m,
        nearest_block_id: row.nearest_block_id,
        nearest_block_type: row.nearest_block_type,
        declared_ump_raw: row.declared_ump_raw,
        declared_ump_normalized: row.declared_ump_normalized,
        advance_block_id: row.advance_block_id,
        advance_block_ump: row.advance_block_ump,
        advance_block_ubigeo: row.advance_block_ubigeo,
        advance_block_distrito: row.advance_block_distrito,
        advance_block_zona: row.advance_block_zona,
        advance_block_manzana: row.advance_block_manzana,
        advance_block_type: row.advance_block_type,
        advance_block_match: row.advance_block_match,
        advance_block_match_status: row.advance_block_match_status,
        advance_valid: row.advance_valid,
        observation_status: row.observation_status,
        observation_reasons: row.observation_reasons,
        validation_status: row.validation_status,
        issues: row.issues,
      })),
      phase: "field",
      alerts: [],
      legend: [],
    },
    route_quota_progress: {
      schema: "monitoreo_territorial_quota_progress_v1",
      configured: true,
      blocks: blocks.map((block) => ({
        id_manzana: block.id_manzana,
        ubigeo: block.ubigeo,
        distrito: block.distrito,
        zona: block.zona,
        manzana: block.manzana,
        tipo_manzana: block.tipo_manzana,
        ump: block.ump,
        configured: true,
        status: block.brecha && block.brecha > 0 ? "partial" : "complete",
        target: block.meta ?? 8,
        validas: block.validas,
        missing_total: block.brecha ?? 0,
        sex: [],
        age: [],
        cross: [],
        missing: [],
      })),
    },
  } as unknown as MonitoreoTerritorialDashboard;
}

describe("territorialCaseAuditModel", () => {
  const ump38 = makeBlock({});
  const ump39 = makeBlock({
    id_manzana: "15010801700011A",
    zona: "01700",
    manzana: "011A",
    orden_seleccion: 39,
    hoja_num: 39,
    rango_inicio: 305,
    rango_fin: 312,
    ump: "39",
    validas: 9,
    brecha: 0,
    avance_pct: 112.5,
  });
  const ump35 = makeBlock({
    id_manzana: "150108013000190",
    zona: "01300",
    manzana: "0190",
    orden_seleccion: 35,
    hoja_num: 35,
    ump: "35",
  });
  const blocks = [ump38, ump39, ump35];
  const assignedAges = [
    ["43146908-ca2c-40d5-a1f7-c2c5d93749d8", "hombre", 21, "2026-06-15T16:38:00-05:00"],
    ["5fe0d51e-65d8-4dcf-9576-5c800fd2b8f6", "mujer", 25, "2026-06-15T16:12:00-05:00"],
    ["631c914f-e9dc-4cfd-b312-da98d691b32a", "hombre", 35, "2026-06-15T17:35:00-05:00"],
    ["8fdb072a-7d3d-476c-a2ad-ecfa0c62a489", "hombre", 42, "2026-06-15T16:50:00-05:00"],
    ["0ab491c9-821b-4254-940e-d87dcd18067d", "mujer", 43, "2026-06-15T16:22:00-05:00"],
    ["b4c9919a-556d-4b79-90cd-2595084d6f8f", "mujer", 49, "2026-06-15T17:03:00-05:00"],
    ["cac41b00-08ab-489f-8511-815ccda605ad", "hombre", 65, "2026-06-15T17:09:00-05:00"],
  ] as const;
  const rows = [
    ...assignedAges.map(([response_id, sex, age, submitted], index) => makeRow({
      row_index: 389 + index,
      response_id,
      sex,
      age,
      submission_time: submitted,
      submission_datetime: submitted,
      submission_hour: submitted.slice(11, 16),
    })),
    makeRow({
      row_index: 384,
      response_id: "83367bf3-b3d5-4ff1-9ffd-f58e1c6d7e3c",
      sex: "2",
      age: 50,
      declared_ump_raw: "39",
      declared_ump_normalized: "39",
      advance_block_id: "15010801700011A",
      advance_block_ump: "39",
      advance_block_zona: "01700",
      advance_block_manzana: "011A",
      nearest_block_id: "150108013000190",
      distance_m: 229.2,
      geo_estado: "geo_revision",
      submission_time: "2026-06-15T16:07:00-05:00",
      submission_datetime: "2026-06-15T16:07:00-05:00",
      submission_hour: "16:07",
    }),
    makeRow({
      row_index: 430,
      response_id: "8f155780-b558-494d-bfbe-0f7995d926aa",
      sex: "2",
      age: 32,
      declared_ump_raw: "39",
      declared_ump_normalized: "39",
      advance_block_id: "15010801700011A",
      advance_block_ump: "39",
      advance_block_zona: "01700",
      advance_block_manzana: "011A",
      nearest_block_id: "150108016000580",
      distance_m: 51.5,
      geo_estado: "geo_cerca",
      submission_time: "2026-06-15T18:26:00-05:00",
      submission_datetime: "2026-06-15T18:26:00-05:00",
      submission_hour: "18:26",
    }),
  ];

  it("audits UMP 38 by declared/reconciled assignment and keeps GPS proximity diagnostic", () => {
    const audit = buildTerritorialUmpCaseAudit(makeReports(rows, blocks), { blockId: "150108016000580" });

    expect(audit.targetBlock?.ump).toBe("38");
    expect(audit.assignedCases).toHaveLength(7);
    expect(audit.summary.validas).toBe(7);
    expect(audit.summary.missing).toBe(1);
    expect(audit.assignedCases.map((item) => item.demographicLabel)).toEqual(["M 25", "M 43", "H 21", "H 42", "M 49", "H 65", "H 35"]);
    expect(audit.candidateCases.map((item) => item.responseId)).toContain("83367bf3-b3d5-4ff1-9ffd-f58e1c6d7e3c");
    const gpsNear = audit.candidateCases.find((item) => item.responseId === "8f155780-b558-494d-bfbe-0f7995d926aa");
    expect(gpsNear?.assignedUmp).toBe("39");
    expect(gpsNear?.nearestUmp).toBe("38");
    expect(gpsNear?.nearestBlockResponsible).toBe("P524");
    expect(gpsNear?.candidateReasons).toContain("gps_near_target");
    expect(gpsNear?.candidateReasons).not.toContain("same_responsible_window");
    expect(gpsNear?.countsInTarget).toBe(false);
  });

  it("flags the M50 record as a same-responsible candidate without counting it in UMP 38", () => {
    const audit = buildTerritorialUmpCaseAudit(makeReports(rows, blocks), { ump: "38" });
    const candidate = audit.candidateCases.find((item) => item.responseId === "83367bf3-b3d5-4ff1-9ffd-f58e1c6d7e3c");

    expect(candidate?.demographicLabel).toBe("M 50");
    expect(candidate?.assignedUmp).toBe("39");
    expect(candidate?.nearestUmp).toBe("35");
    expect(candidate?.candidateReasons).toContain("same_responsible_window");
    expect(audit.summary.assignedCount).toBe(7);
  });

  it("builds only response-scoped UMP reconciliation payloads from the consultant", () => {
    const audit = buildTerritorialUmpCaseAudit(makeReports(rows, blocks), { blockId: "150108016000580" });
    const candidate = audit.candidateCases.find((item) => item.responseId === "83367bf3-b3d5-4ff1-9ffd-f58e1c6d7e3c");
    const payload = candidate ? buildTerritorialUmpResponseReconciliation(candidate, ump38, "field", "Ficha física indica UMP 38.") : null;

    expect(payload).toMatchObject({
      response_id: "83367bf3-b3d5-4ff1-9ffd-f58e1c6d7e3c",
      response_id_field: "row_index",
      raw_ump: "39",
      assigned_block_id: "150108016000580",
      assigned_ump: "38",
      assigned_district: "CHORRILLOS",
      assigned_ubigeo: "150108",
      phase: "field",
      note: "Ficha física indica UMP 38.",
      scope: "response",
    });
    expect(payload?.scope).not.toBe("ump_value");
  });
});
