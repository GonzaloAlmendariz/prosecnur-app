import { describe, expect, it } from "vitest";
import type {
  MonitoreoFieldOccurrenceDashboard,
  MonitoreoFieldOccurrenceRecord,
  MonitoreoFieldOccurrenceUmpSummary,
  MonitoreoRow,
} from "../../api/client";
import { buildOccurrenceDistrictSummary, buildOccurrenceRouteUmpRows } from "./fieldOccurrences";

function record(patch: Partial<MonitoreoFieldOccurrenceRecord>): MonitoreoFieldOccurrenceRecord {
  return {
    row_id: "r1",
    codigo_pulso: "P001",
    date: "2026-06-16",
    date_label: "16 Junio",
    hora_inicio: "8:00am",
    hora_final: "10:00am",
    hora_label: "8:00am-10:00am",
    datetime_label: "16 Junio · 8:00am",
    phase: "field",
    responsable: "Ana Campo",
    distrito: "ATE",
    ubigeo: "150103",
    zona: "01",
    manzana: "0390",
    manzana_key: "m0001",
    tipo_manzana: "titular",
    ump: "1",
    route_label: "ATE · Zona 01 · Mz 0390 · UMP 1",
    total_manzanas_recorridas: 1,
    no_efectivas: 1,
    efectivas: 7,
    intentos: 8,
    tasa_no_efectiva: 0.125,
    observaciones: "",
    ...patch,
  };
}

function summary(patch: Partial<MonitoreoFieldOccurrenceUmpSummary>): MonitoreoFieldOccurrenceUmpSummary {
  const intentos = Number(patch.intentos ?? 8);
  const noEfectivas = Number(patch.no_efectivas ?? 1);
  return {
    key: "m0001",
    ump: "1",
    manzana: "0390",
    manzana_key: "m0001",
    route_label: "ATE · Zona 01 · Mz 0390 · UMP 1",
    distrito: "ATE",
    zona: "01",
    responsable: "Ana Campo",
    reportes: 1,
    efectivas: 7,
    no_efectivas: noEfectivas,
    intentos,
    tasa_no_efectiva: intentos > 0 ? noEfectivas / intentos : null,
    ultimo_reporte: "16 Junio · 8:00am",
    outcomes: [
      { key: "hogar_ausente", label: "Miembros del hogar ausentes", total: noEfectivas },
      { key: "no_queria_participar", label: "No quería participar", total: 0 },
    ],
    ...patch,
  };
}

function routeChoice(patch: MonitoreoRow = {}): MonitoreoRow {
  return {
    route_key: "m0001",
    distrito: "ATE",
    ubigeo: "150103",
    zona: "01",
    manzana: "0390",
    ump_group: "1",
    block_label: "Mz 0390 · Zona 01 · Titular",
    tipo_manzana: "titular",
    ...patch,
  };
}

function dashboard(patch: Partial<MonitoreoFieldOccurrenceDashboard> = {}): MonitoreoFieldOccurrenceDashboard {
  return {
    schema: "monitoreo_field_occurrences_v1",
    generated_at: "2026-06-16T00:00:00Z",
    config: {
      enabled: true,
      form_title: "OCURRENCIAS",
      form_id: "ocurrencias",
      asset_uid: "asset",
      asset_name: "Ocurrencias",
      version_id: "",
      source_id: "",
      base_url: "",
      survey_url: "",
      asset_url: "",
      connection_profile_id: "",
      status: "synced",
      generated_at: "",
      uploaded_at: "",
      last_sync_at: "",
      xlsform_file_id: "",
      xlsform_filename: "",
      code_var: "codigo_pulso",
      start_time_var: "hora_inicio",
      end_time_var: "hora_final",
      route_phase: "field",
      route_choices: [routeChoice()],
    },
    summary: {
      total_records: 1,
      days_reported: 1,
      responsables: 1,
      manzanas_reportadas: 1,
      efectivas: 7,
      no_efectivas: 1,
      intentos: 8,
      tasa_no_efectiva: 0.125,
    },
    by_outcome: [],
    by_day: [],
    by_responsable: [],
    by_ump: [summary({})],
    records: [record({})],
    alerts: {
      missing_blocks: [],
      high_non_effective: [],
      observations: [],
      outside_route: [],
    },
    ...patch,
  };
}

describe("buildOccurrenceRouteUmpRows", () => {
  it("marks a normal consolidated UMP as reportada no efectiva when it has non-effective outcomes", () => {
    const rows = buildOccurrenceRouteUmpRows({ occurrences: dashboard() });

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("reportada_no_efectiva");
    expect(rows[0].has_report).toBe(true);
    expect(rows[0].dominant_outcome?.label).toBe("Miembros del hogar ausentes");
  });

  it("adds expected UMPs without reports as sin_reporte", () => {
    const rows = buildOccurrenceRouteUmpRows({
      occurrences: dashboard({
        config: { ...dashboard().config, route_choices: [routeChoice(), routeChoice({ route_key: "m0002", ump_group: "2", manzana: "0391" })] },
        alerts: {
          missing_blocks: [routeChoice({ route_key: "m0002", ump_group: "2", manzana: "0391" })],
          high_non_effective: [],
          observations: [],
          outside_route: [],
        },
      }),
    });

    expect(rows.some((row) => row.ump === "2" && row.status === "sin_reporte")).toBe(true);
  });

  it("keeps the route responsible on expected UMPs without occurrence reports", () => {
    const rows = buildOccurrenceRouteUmpRows({
      occurrences: dashboard({
        config: {
          ...dashboard().config,
          route_choices: [routeChoice({ responsable: "P132 · Venturo Perales Rosa Magda" })],
        },
        by_ump: [],
        records: [],
      }),
    });

    expect(rows[0].status).toBe("sin_reporte");
    expect(rows[0].responsable).toBe("P132 · Venturo Perales Rosa Magda");
  });

  it("rolls replacement route blocks into the titular UMP for occurrence coverage", () => {
    const titularBlock = routeChoice({
      route_key: "m0143",
      ump_group: "143",
      manzana: "0590",
      block_label: "Mz 0590 · Zona 01 · Titular",
    });
    const replacementBlock = routeChoice({
      route_key: "m0143-r1",
      ump_group: "143 · R1",
      ump: "143 · R1",
      manzana: "0440",
      block_label: "Mz 0440 · Zona 01 · Reemplazo de UMP 143",
      tipo_manzana: "reemplazo",
      titular_hoja_num: "143",
      titular_id_manzana: "m0143",
    });
    const rows = buildOccurrenceRouteUmpRows({
      occurrences: dashboard({
        config: { ...dashboard().config, route_choices: [titularBlock, replacementBlock] },
        by_ump: [
          summary({
            key: "m0143-r1",
            ump: "143",
            manzana: "0440",
            manzana_key: "m0143-r1",
            route_label: "ATE · Zona 01 · Mz 0440 · UMP 143",
            distrito: "ATE",
          }),
        ],
        records: [
          record({
            row_id: "r-replacement",
            ump: "143",
            manzana: "0440",
            manzana_key: "m0143-r1",
            tipo_manzana: "reemplazo",
          }),
        ],
      }),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].ump).toBe("143");
    expect(rows[0].expected_blocks).toHaveLength(2);
    expect(rows[0].has_report).toBe(true);
  });

  it("does not duplicate an expected UMP when a missing alert uses a different district label", () => {
    const rows = buildOccurrenceRouteUmpRows({
      occurrences: dashboard({
        config: { ...dashboard().config, route_choices: [routeChoice({ route_key: "m0001", distrito: "ATE", ump_group: "1", titular_hoja_num: "NA" })] },
        alerts: {
          missing_blocks: [routeChoice({ route_key: "m0001-shadow", distrito: "150103", district_key: "150103", ump_group: "1" })],
          high_non_effective: [],
          observations: [],
          outside_route: [],
        },
      }),
    });

    expect(rows.filter((row) => row.ump === "1")).toHaveLength(1);
  });

  it("splits UMPs with advance but no occurrence report by quota completion", () => {
    const occurrences = dashboard({
      config: {
        ...dashboard().config,
        route_choices: [
          routeChoice({ route_key: "m0001", ump_group: "1", manzana: "0390" }),
          routeChoice({ route_key: "m0002", ump_group: "2", manzana: "0391" }),
        ],
      },
      records: [],
      by_ump: [
        summary({
          key: "m0001",
          ump: "1",
          reportes: 0,
          efectivas: 0,
          no_efectivas: 0,
          intentos: 0,
          has_report: false,
          estado_consolidado: "completa_sin_reporte",
	          avance_validas: 4,
	          avance_meta: 4,
	          avance_completa: true,
	          avance_estado_cuota: "Completa",
	          avance_ultimo_ingreso: "9 Junio",
        }),
        summary({
          key: "m0002",
          ump: "2",
          manzana: "0391",
          manzana_key: "m0002",
          route_label: "ATE · Zona 01 · Mz 0391 · UMP 2",
          reportes: 0,
          efectivas: 0,
          no_efectivas: 0,
          intentos: 0,
          has_report: false,
          estado_consolidado: "incompleta_sin_reporte",
          avance_validas: 2,
          avance_meta: 4,
          avance_completa: false,
          avance_estado_cuota: "Cuota pendiente",
          avance_ultimo_ingreso: "17 Junio",
        }),
      ],
      by_district: undefined,
    });
    const rows = buildOccurrenceRouteUmpRows({ occurrences });
    const complete = rows.find((row) => row.ump === "1");
    const incomplete = rows.find((row) => row.ump === "2");
    const districts = buildOccurrenceDistrictSummary(occurrences, rows);
    const ate = districts.find((row) => row.distrito === "ATE");

    expect(complete?.status).toBe("completa_sin_reporte");
    expect(complete?.advance_validas).toBe(4);
    expect(complete?.advance_complete).toBe(true);
    expect(complete?.attention_reasons).toContain("completa_sin_reporte");
    expect(incomplete?.status).toBe("incompleta_sin_reporte");
    expect(incomplete?.advance_validas).toBe(2);
    expect(incomplete?.advance_complete).toBe(false);
    expect(incomplete?.attention_reasons).toContain("incompleta_sin_reporte");
	    expect(ate?.ump_completas_sin_reporte).toBe(1);
	    expect(ate?.ump_incompletas_sin_reporte).toBe(1);
	    expect(ate?.validas_sin_reporte).toBe(6);
	    expect(ate?.ultimo_ingreso_sin_reporte).toBe("17 Junio");
	  });

  it("keeps high non-effective incidence as reportada no efectiva", () => {
    const highRecord = record({ no_efectivas: 7, efectivas: 2, intentos: 9, tasa_no_efectiva: 0.7777 });
    const rows = buildOccurrenceRouteUmpRows({
      occurrences: dashboard({
        by_ump: [summary({ no_efectivas: 7, efectivas: 2, intentos: 9, tasa_no_efectiva: 0.7777 })],
        records: [highRecord],
        alerts: {
          missing_blocks: [],
          high_non_effective: [highRecord],
          observations: [],
          outside_route: [],
        },
      }),
    });

    expect(rows[0].status).toBe("reportada_no_efectiva");
    expect(rows[0].dominant_outcome?.total).toBe(7);
  });

  it("keeps observations as a secondary reason without changing the consolidated result", () => {
    const observed = record({ observaciones: "Se reporta acceso restringido." });
    const rows = buildOccurrenceRouteUmpRows({
      occurrences: dashboard({
        records: [observed],
        alerts: {
          missing_blocks: [],
          high_non_effective: [],
          observations: [observed],
          outside_route: [],
        },
      }),
    });

    expect(rows[0].status).toBe("reportada_no_efectiva");
    expect(rows[0].attention_reasons).toContain("observacion");
    expect(rows[0].observation_excerpt).toBe("Se reporta acceso restringido.");
  });

  it("keeps multiple consolidated reports visible and marked for review", () => {
    const rows = buildOccurrenceRouteUmpRows({
      occurrences: dashboard({
        by_ump: [summary({ reportes: 2, intentos: 14, efectivas: 12, no_efectivas: 2, tasa_no_efectiva: 2 / 14 })],
        records: [record({ row_id: "r1" }), record({ row_id: "r2", datetime_label: "16 Junio · 11:00am" })],
      }),
    });

    expect(rows[0].has_multiple_reports).toBe(true);
    expect(rows[0].status).toBe("revisar_cruce");
    expect(rows[0].attention_reasons).toContain("multiples_consolidados");
  });

  it("marks a reported UMP outside the expected route without inferring district", () => {
    const outside = record({
      row_id: "r-typo",
      ump: "1437",
      distrito: "",
      zona: "",
      manzana: "",
      manzana_key: "ump:1437",
      route_label: "UMP 1437 no está en las UMP esperadas de la ruta",
      route_match_status: "ump_no_esperada",
      route_match_message: "UMP 1437 no está en las UMP esperadas de la ruta",
    });
    const occurrences = dashboard({
      config: {
        ...dashboard().config,
        route_choices: [routeChoice({ route_key: "m0143", ump_group: "143", distrito: "SAN MARTIN DE PORRES", manzana: "0590" })],
      },
      by_ump: [
        summary({
          key: "1437",
          ump: "1437",
          manzana: "",
          manzana_key: "ump:1437",
          route_label: "UMP 1437 no está en las UMP esperadas de la ruta",
          distrito: "",
          zona: "",
          estado_consolidado: "revisar_cruce",
          route_match_status: "ump_no_esperada",
          route_match_message: "UMP 1437 no está en las UMP esperadas de la ruta",
        }),
      ],
      records: [outside],
      alerts: {
        missing_blocks: [routeChoice({ route_key: "m0143", ump_group: "143", distrito: "SAN MARTIN DE PORRES", manzana: "0590" })],
        high_non_effective: [],
        observations: [],
        outside_route: [outside],
      },
      by_district: undefined,
    });
    const rows = buildOccurrenceRouteUmpRows({ occurrences });
    const invalid = rows.find((row) => row.ump === "1437");
    const expected = rows.find((row) => row.ump === "143");
    const districts = buildOccurrenceDistrictSummary(occurrences, rows);

    expect(invalid?.status).toBe("revisar_cruce");
    expect(invalid?.distrito).toBe("");
    expect(invalid?.is_unreconciled).toBe(true);
    expect(invalid?.attention_reasons).toContain("ump_no_esperada");
    expect(invalid?.route_match_message).toContain("no está en las UMP esperadas");
    expect(expected?.status).toBe("sin_reporte");
    expect(districts.find((row) => row.distrito === "UMP sin conciliación")?.ump_reportadas).toBe(0);
    expect(districts.find((row) => row.distrito === "SAN MARTIN DE PORRES")?.ump_sin_reporte).toBe(1);
  });

  it("sorts consolidated rows before UMPs without a consolidated report", () => {
    const rows = buildOccurrenceRouteUmpRows({
      occurrences: dashboard({
        config: {
          ...dashboard().config,
          route_choices: [
            routeChoice({ route_key: "m0001", ump_group: "1" }),
            routeChoice({ route_key: "m0002", ump_group: "2", manzana: "0391" }),
            routeChoice({ route_key: "m0003", ump_group: "3", manzana: "0392" }),
          ],
        },
        by_ump: [
          summary({ key: "m0001", ump: "1", intentos: 8, efectivas: 7, no_efectivas: 1, tasa_no_efectiva: 0.125 }),
          summary({ key: "m0003", ump: "3", manzana: "0392", intentos: 10, efectivas: 2, no_efectivas: 8, tasa_no_efectiva: 0.8 }),
        ],
        records: [
          record({ row_id: "r1", ump: "1", manzana_key: "m0001" }),
          record({ row_id: "r3", ump: "3", manzana: "0392", manzana_key: "m0003", no_efectivas: 8, efectivas: 2, intentos: 10, tasa_no_efectiva: 0.8 }),
        ],
      }),
    });

    expect(rows.map((row) => row.status)).toEqual(["reportada_no_efectiva", "reportada_no_efectiva", "sin_reporte"]);
  });

  it("derives district summaries from route UMP rows when backend summary is missing", () => {
    const occurrences = dashboard({
      config: {
        ...dashboard().config,
        route_choices: [
          routeChoice({ route_key: "m0001", ump_group: "1", distrito: "ATE" }),
          routeChoice({ route_key: "m0002", ump_group: "2", manzana: "0391", distrito: "ATE" }),
          routeChoice({ route_key: "m0003", ump_group: "3", manzana: "0392", distrito: "CHORRILLOS" }),
        ],
      },
      by_ump: [
        summary({ key: "m0001", ump: "1", distrito: "ATE", intentos: 8, efectivas: 7, no_efectivas: 1, tasa_no_efectiva: 0.125 }),
        summary({ key: "m0003", ump: "3", distrito: "CHORRILLOS", manzana: "0392", intentos: 10, efectivas: 10, no_efectivas: 0, tasa_no_efectiva: 0 }),
      ],
      records: [
        record({ row_id: "r1", ump: "1", distrito: "ATE", manzana_key: "m0001" }),
        record({ row_id: "r3", ump: "3", distrito: "CHORRILLOS", manzana: "0392", manzana_key: "m0003", no_efectivas: 0, efectivas: 10, intentos: 10, tasa_no_efectiva: 0 }),
      ],
      by_district: undefined,
    });
    const rows = buildOccurrenceRouteUmpRows({ occurrences });
    const districts = buildOccurrenceDistrictSummary(occurrences, rows);

    const ate = districts.find((row) => row.distrito === "ATE");
    const chorrillos = districts.find((row) => row.distrito === "CHORRILLOS");
    expect(ate?.ump_reportadas).toBe(1);
    expect(ate?.ump_sin_reporte).toBe(1);
    expect(ate?.motivo_principal).toBe("Miembros del hogar ausentes");
    expect(chorrillos?.ump_reportadas).toBe(1);
    expect(chorrillos?.no_efectivas).toBe(0);
  });
});
