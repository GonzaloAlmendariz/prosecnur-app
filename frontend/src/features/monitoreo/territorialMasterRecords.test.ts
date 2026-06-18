import { describe, expect, it } from "vitest";
import type { TerritorialResponseAuditRow } from "../../api/client";
import {
  buildTerritorialMasterRecordRows,
  filterTerritorialMasterRecordRows,
  summarizeTerritorialMasterRecordRows,
  territorialMasterRecordOptions,
} from "./territorialMasterRecords";

function auditRow(patch: Partial<TerritorialResponseAuditRow> = {}): TerritorialResponseAuditRow {
  return {
    row_index: 1,
    response_id: "uuid-1",
    district_code: "150103",
    distrito: "ATE",
    ubigeo: "150103",
    consent: "yes",
    age: 32,
    sex: "Mujer",
    status: "",
    submitted_by: "P375",
    pulso_code: "P375",
    pulso_code_normalized: "P375",
    enumerator_assigned: "Huanca Criollo Daniel Angel",
    responsible_display: "P375 · Huanca Criollo Daniel Angel",
    submission_time: "2026-06-18T15:30:00Z",
    submission_date_iso: "2026-06-18",
    submission_date: "18 Junio",
    submission_hour: "3:30pm",
    submission_datetime: "2026-06-18T15:30:00Z",
    duration_seconds: 580,
    duration_status: "esperada",
    duration_operational_status: "normal",
    duration_operational_label: "Normal",
    lat: -12.045,
    lon: -77.032,
    gps_parseable: true,
    geo_estado: "geo_ok",
    distance_m: 18,
    nearest_block_id: "0410",
    nearest_block_type: "titular",
    declared_ump_raw: "76",
    declared_ump_normalized: "76",
    advance_block_ump: "76",
    advance_block_manzana: "0410",
    advance_block_distrito: "ATE",
    advance_block_zona: "00100",
    advance_valid: true,
    observation_status: "sin_observacion",
    validation_status: "validada",
    source_effective: true,
    issues: "",
    ...patch,
  };
}

describe("territorialMasterRecords", () => {
  it("builds one visible master row per response audit record ordered by recency", () => {
    const rows = buildTerritorialMasterRecordRows([
      auditRow({ response_id: "old", row_index: 1, submission_datetime: "2026-06-17T08:00:00Z" }),
      auditRow({ response_id: "recent", row_index: 2, submission_datetime: "2026-06-18T08:00:00Z" }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.responseId)).toEqual(["recent", "old"]);
  });

  it("filters the master table by search, district, responsible, UMP and operational state", () => {
    const rows = buildTerritorialMasterRecordRows([
      auditRow({ response_id: "clean-ate", advance_block_ump: "76", distrito: "ATE" }),
      auditRow({
        response_id: "short-sjl",
        advance_block_ump: "88",
        distrito: "SAN JUAN DE LURIGANCHO",
        responsible_display: "P940 · González Rubio Alonso",
        duration_seconds: 48,
        duration_status: "muy_corta",
        duration_operational_status: "muy_corto",
        duration_operational_label: "Muy corto",
      }),
    ]);
    const options = territorialMasterRecordOptions(rows);

    expect(options.districts).toContain("SAN JUAN DE LURIGANCHO");
    expect(options.responsibles).toContain("P940 · González Rubio Alonso");
    expect(options.umps).toContain("88");
    expect(filterTerritorialMasterRecordRows(rows, {
      search: "gonzalez",
      district: "SAN JUAN DE LURIGANCHO",
      responsible: "P940 · González Rubio Alonso",
      ump: "88",
      state: "pendiente",
    }).map((row) => row.responseId)).toEqual(["short-sjl"]);
  });

  it("keeps explicit coordinates out of the master-row surface", () => {
    const [row] = buildTerritorialMasterRecordRows([auditRow()]);

    expect(Object.keys(row)).not.toEqual(expect.arrayContaining(["lat", "lon", "altitud", "altitude"]));
    expect(row.source.lat).toBe(-12.045);
    expect(row.source.lon).toBe(-77.032);
  });

  it("summarizes clean, duration and GPS review records from response audit rows", () => {
    const summary = summarizeTerritorialMasterRecordRows(buildTerritorialMasterRecordRows([
      auditRow({ response_id: "clean" }),
      auditRow({
        response_id: "duration",
        duration_seconds: 40,
        duration_status: "corta",
        duration_operational_status: "corto",
        duration_operational_label: "Corto",
      }),
      auditRow({ response_id: "gps", geo_estado: "geo_sin_gps", gps_parseable: false, lat: null, lon: null }),
    ]));

    expect(summary).toMatchObject({ total: 3, clean: 1, review: 2, duration: 1, gps: 1 });
  });

  it("counts raw duration_status fallback when operational duration fields are missing", () => {
    const rows = buildTerritorialMasterRecordRows([
      auditRow({
        response_id: "raw-short",
        duration_status: "muy_corta",
        duration_operational_status: undefined,
        duration_operational_label: undefined,
      }),
    ]);

    expect(rows[0].state).toBe("pendiente");
    expect(summarizeTerritorialMasterRecordRows(rows).duration).toBe(1);
  });
});
