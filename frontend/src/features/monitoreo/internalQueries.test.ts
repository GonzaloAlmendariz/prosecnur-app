import { describe, expect, it } from "vitest";
import type { MonitoreoInternalQueries } from "../../api/client";
import {
  EMPTY_INTERNAL_QUERY_FILTERS,
  buildInternalExecutiveAnswer,
  filterInternalQueryCases,
  formatInternalQueryDateAxisLabel,
  formatInternalQueryDateLabel,
  internalQueryCollectorDisplayLabel,
  internalQueryCollectorValue,
  internalQueryTemplateById,
  internalQueryTemplatesForBlock,
  internalQueryCaseTone,
  internalQueryOptions,
  normalizeInternalQueries,
  summarizeInternalCases,
} from "./internalQueries";

describe("internalQueries", () => {
  const model: MonitoreoInternalQueries = {
    schema: "monitoreo_acreditacion_internal_queries_v1",
    cases: [
      {
        actor: "Estudiantes",
        person_label: "Ana",
        case_key: "codigo:A1",
        response_id: "r1",
        date: "2026-06-05",
        source_id: "sm-est",
        source_label: "SurveyMonkey Estudiantes",
        channel: "Ficha QR",
        collector_id: "QR_AULA",
        collector_name: "QR aula",
        platform_state: "Completa",
        base_result: "Cruzó",
        base_record: "A1",
        base_source: "Faltantes",
        base_status: "No barrido",
        decision: "Incluido en avance",
        decision_reason: "Cruce exacto",
        advancement: "effective",
        issue_type: "efectiva_real",
        rule: "sale de pendientes",
        pending_exit: "TRUE",
        recovery_collector: false,
        response_row: 7,
        duplicate_count: 1,
      },
      {
        actor: "Docentes",
        person_label: "",
        case_key: "",
        response_id: "r2",
        date: "2026-06-08",
        source_id: "sm-doc",
        source_label: "SurveyMonkey Docentes",
        channel: "Correo",
        collector_id: "WEB1",
        collector_name: "Web Link 1",
        platform_state: "Parcial",
        base_result: "Sin llave",
        base_record: "",
        base_source: "",
        base_status: "",
        decision: "Excluido del avance",
        decision_reason: "Sin llave",
        advancement: "partial",
        issue_type: "parcial_no_identificable",
        rule: "no cuenta como efectiva",
        pending_exit: false,
        recovery_collector: false,
        response_row: 8,
        duplicate_count: 2,
      },
      {
        actor: "Egresados",
        person_label: "Luis Pendiente",
        case_key: "codigo:E1",
        response_id: "",
        date: "Sin fecha",
        source_id: "base-egr",
        source_label: "Universo · Egresados",
        channel: "",
        collector_id: "",
        collector_name: "Sin responsable",
        platform_state: "Sin respuesta",
        base_result: "Cruzó",
        base_record: "E1",
        base_source: "Universo · Egresados",
        base_status: "Pendiente",
        decision: "Pendiente de respuesta",
        decision_reason: "Existe en la base del corte y no tiene respuesta SurveyMonkey reconciliada.",
        advancement: "pending",
        issue_type: "sin_respuesta",
        rule: "Caso en base sin respuesta reconciliada; queda para seguimiento operativo.",
        pending_exit: false,
        recovery_collector: false,
        response_row: 0,
        duplicate_count: 1,
      },
    ],
    totals: {
      actor: [],
      date: [],
      channel: [],
      source: [],
      collector: [],
    },
    pending_exit: [],
    issues: [],
    flow: {
      nodes: [],
      links: [],
    },
  };

  it("normalizes booleans and summarizes case states", () => {
    const normalized = normalizeInternalQueries(model);
    const summary = summarizeInternalCases(normalized.cases);

    expect(normalized.cases[0].pending_exit).toBe(true);
    expect(summary.effective).toBe(1);
    expect(summary.partial).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.pendingExit).toBe(1);
    expect(summary.duplicates).toBe(1);
  });

  it("filters by text and stable option sets", () => {
    const normalized = normalizeInternalQueries(model);
    const filtered = filterInternalQueryCases(normalized.cases, {
      ...EMPTY_INTERNAL_QUERY_FILTERS,
      search: "docentes sin llave",
    });
    const options = internalQueryOptions(normalized.cases);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].response_id).toBe("r2");
    expect(options.actors).toEqual(["Docentes", "Egresados", "Estudiantes"]);
    expect(internalQueryCaseTone(filtered[0])).toBe("partial");
  });

  it("filters base cases that still have no response", () => {
    const normalized = normalizeInternalQueries(model);
    const filtered = filterInternalQueryCases(normalized.cases, {
      ...EMPTY_INTERNAL_QUERY_FILTERS,
      state: "pending",
    });
    const nonEffective = filterInternalQueryCases(normalized.cases, {
      ...EMPTY_INTERNAL_QUERY_FILTERS,
      state: "non_effective",
    });
    const options = internalQueryOptions(normalized.cases);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].person_label).toBe("Luis Pendiente");
    expect(filtered[0].platform_state).toBe("Sin respuesta");
    expect(nonEffective).toHaveLength(2);
    expect(options.states).toContain("non_effective");
  });

  it("matches pending-exit semantic searches used by flow nodes", () => {
    const normalized = normalizeInternalQueries(model);
    const filtered = filterInternalQueryCases(normalized.cases, {
      ...EMPTY_INTERNAL_QUERY_FILTERS,
      search: "faltantes / barrido",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].response_id).toBe("r1");
  });

  it("matches Spanish weekday date searches for operational questions", () => {
    const normalized = normalizeInternalQueries(model);
    const filtered = filterInternalQueryCases(normalized.cases, {
      ...EMPTY_INTERNAL_QUERY_FILTERS,
      search: "viernes 5 QR aula",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].response_id).toBe("r1");
  });

  it("formats valid dates and keeps undated records explicit", () => {
    const normalized = normalizeInternalQueries({
      ...model,
      cases: [
        ...model.cases,
        {
          ...model.cases[1],
          response_id: "r3",
          date: "",
          duplicate_count: 1,
        },
      ],
    });
    const options = internalQueryOptions(normalized.cases);

    expect(formatInternalQueryDateLabel("2026-06-05")).toBe("5 junio");
    expect(formatInternalQueryDateAxisLabel("05/06/2026")).toBe("5 jun");
    expect(formatInternalQueryDateLabel("")).toBe("Sin fecha");
    expect(options.dates).toEqual(["2026-06-05", "2026-06-08", "Sin fecha"]);
  });

  it("shows operational collector labels while preserving stable filter values", () => {
    const normalized = normalizeInternalQueries(model);

    expect(internalQueryCollectorValue(normalized.cases[0])).toBe("QR aula");
    expect(internalQueryCollectorDisplayLabel(normalized.cases[0])).toBe("Enlace QR aula");
    expect(internalQueryCollectorValue(normalized.cases[1])).toBe("Web Link 1");
    expect(internalQueryCollectorDisplayLabel(normalized.cases[1])).toBe("Correo Docentes");
  });

  it("groups operational query templates by the five entry blocks", () => {
    expect(internalQueryTemplatesForBlock("avance").map((item) => item.id)).toContain("avance-general");
    expect(internalQueryTemplatesForBlock("cruces").map((item) => item.id)).toContain("cruce-faltantes-salida");
    expect(internalQueryTemplatesForBlock("campo").map((item) => item.id)).toContain("campo-faltantes-presencial");
    expect(internalQueryTemplatesForBlock("auditoria").map((item) => item.id)).toContain("auditoria-duplicados");
  });

  it("builds an executive answer from the selected operational question", () => {
    const normalized = normalizeInternalQueries(model);
    const summary = summarizeInternalCases(normalized.cases);
    const template = internalQueryTemplateById("cruce-faltantes-salida");
    const answer = buildInternalExecutiveAnswer(template, summary, summary, false);

    expect(answer.title).toContain("1 caso sigue sin respuesta");
    expect(answer.detail).toContain("1 caso sale de pendientes");
  });
});
