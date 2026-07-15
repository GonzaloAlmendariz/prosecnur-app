import { describe, expect, it } from "vitest";
import {
  buildOperationalStatusLabels,
  buildOperationalNarratives,
  defaultOperationalConfig,
  hasOperationalConfigChanges,
  normalizeOperationalConfig,
  rankOperationalVariables,
  validateOperationalConfig,
} from "./operationalControlsModel";
import type { ExploradorVariable } from "./types";

describe("operational controls model", () => {
  it("uses conservative disabled defaults and fixed missing policies", () => {
    expect(defaultOperationalConfig()).toEqual({
      version: 2,
      field_period: {
        enabled: false,
        variable: "",
        start_date: "",
        end_date: "",
        timezone: "America/Lima",
      },
      duplicates: {
        enabled: false,
        variables: [],
        matching_method: "response_similarity",
        similarity_threshold: 0.9,
        minimum_coverage: 0.8,
      },
    });
  });

  it("normalizes backend input without silently enabling or selecting controls", () => {
    const normalized = normalizeOperationalConfig({
      version: 2,
      field_period: {
        enabled: false,
        variable: "",
        start_date: "",
        end_date: "",
        timezone: "",
      },
      duplicates: {
        enabled: false,
        variables: [],
        matching_method: "response_similarity",
        similarity_threshold: 0.9,
        minimum_coverage: 0.8,
      },
    });
    expect(normalized.field_period.timezone).toBe("America/Lima");
    expect(normalized.duplicates.variables).toEqual([]);
  });

  it("validates atomic build requirements and date order", () => {
    const config = defaultOperationalConfig();
    config.field_period = {
      enabled: true,
      variable: "field_date",
      start_date: "2026-07-10",
      end_date: "2026-07-01",
      timezone: "America/Lima",
    };
    config.duplicates.enabled = true;
    expect(validateOperationalConfig(config)).toEqual({
      field_period: "El inicio del operativo no puede ser posterior al cierre.",
      duplicates: "Elige al menos 10 preguntas para comparar respuestas con suficiente precisión.",
    });
  });

  it("compares configs independently from multi-select order", () => {
    const applied = defaultOperationalConfig();
    applied.duplicates = {
      enabled: true,
      variables: Array.from({ length: 10 }, (_, index) => `q${index + 1}`),
      matching_method: "response_similarity",
      similarity_threshold: 0.9,
      minimum_coverage: 0.8,
    };
    const draft = structuredClone(applied);
    draft.duplicates.variables.reverse();
    expect(hasOperationalConfigChanges(draft, applied)).toBe(false);
    draft.field_period.enabled = true;
    expect(hasOperationalConfigChanges(draft, applied)).toBe(true);
  });

  it("only reorders suggestions; it does not create a selection", () => {
    const vars: ExploradorVariable[] = [
      variable("notes", "texto"),
      variable("mand_Date", "fecha"),
      variable("telephone", "texto"),
    ];
    expect(rankOperationalVariables(vars, "period")[0]?.name).toBe("mand_Date");
    expect(rankOperationalVariables(vars, "duplicates")[0]?.name).not.toBe("telephone");
    expect(defaultOperationalConfig().field_period.variable).toBe("");
  });

  it("describes universe, condition, violation and action explicitly", () => {
    const config = defaultOperationalConfig();
    config.duplicates = {
      enabled: true,
      variables: Array.from({ length: 10 }, (_, index) => `q${index + 1}`),
      matching_method: "response_similarity",
      similarity_threshold: 0.9,
      minimum_coverage: 0.8,
    };
    const narrative = buildOperationalNarratives(config)[0];
    expect(narrative?.variables).toContain("10 preguntas");
    expect(narrative?.universe).toContain("después de retirar las pruebas");
    expect(narrative?.condition).toContain("90%");
    expect(narrative?.condition).toContain("80%");
    expect(narrative?.violation).toContain("ambas entrevistas");
    expect(narrative?.action).toContain("conservar o excluir");
    expect(JSON.stringify(narrative)).not.toMatch(/clave|tupla/i);
  });

  it("summarizes the manually configured field period and similarity threshold", () => {
    const config = defaultOperationalConfig();
    config.field_period = {
      enabled: true,
      variable: "end",
      start_date: "2026-06-30",
      end_date: "2026-07-06",
      timezone: "America/Lima",
    };
    config.duplicates.enabled = true;

    expect(buildOperationalStatusLabels(config)).toEqual({
      fieldPeriod: "Campo · 30 jun.–6 jul.",
      duplicates: "Similitud · 90%",
    });
  });
});

function variable(name: string, tipo: ExploradorVariable["tipo"]): ExploradorVariable {
  return { name, label: name, tipo, n_validos: 100, n_nulos: 0 };
}
