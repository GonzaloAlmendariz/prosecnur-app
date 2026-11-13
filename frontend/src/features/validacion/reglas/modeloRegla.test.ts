import { describe, expect, it } from "vitest";
import type { ExploradorVariable } from "../types";
import {
  gateConditionToExpr,
  gateExprFromConditions,
  hierarchyMapFromRows,
  hierarchyRowsFromParams,
  nombreSugerido,
  normalizeParamsForSubmit,
  normalizeTreatmentAction,
  normalizeTreatmentScope,
  operatorOptionsForVariable,
  paramList,
  parseHierarchyMapText,
  treatmentActionsForTipo,
  treatmentDefaultFor,
  validateGateConditions,
} from "./modeloRegla";
import { TIPOS } from "./tiposDeRegla";

const variable = (tipo: ExploradorVariable["tipo"]): ExploradorVariable => ({ name: "v", label: "V", tipo, n_validos: 1, n_nulos: 0 });

describe("modeloRegla: jerarquía de selección múltiple", () => {
  it("ida y vuelta: filas, mapa y texto JSON dan el mismo mapa", () => {
    const filas = hierarchyRowsFromParams({ hierarchy_rows: [{ trigger: "3", required: ["1", "2", "3"] }] });
    expect(filas).toEqual([{ trigger: "3", required: "1\n2\n3" }]);
    // El disparador no se exige a sí mismo y los repetidos se quitan.
    expect(hierarchyMapFromRows([...filas, { trigger: "4", required: "1, 1" }])).toEqual({ "3": ["1", "2"], "4": ["1"] });
    expect(hierarchyRowsFromParams({ hierarchy_map: { "3": ["1", "2"] } })).toEqual([{ trigger: "3", required: "1\n2" }]);
    expect(hierarchyRowsFromParams({ hierarchy_map_text: '{"3": "1 2"}' })).toEqual([{ trigger: "3", required: "1\n2" }]);
    expect(hierarchyRowsFromParams({})).toEqual([{ trigger: "", required: "" }]);
  });

  it("el texto del mapa se valida", () => {
    expect(parseHierarchyMapText("")).toEqual({ ok: false, error: "Define el mapa manual en formato JSON." });
    expect(parseHierarchyMapText("{x")).toEqual({ ok: false, error: "El mapa manual debe ser JSON válido." });
    expect(parseHierarchyMapText("[1]").ok).toBe(false);
  });
});

describe("modeloRegla: parámetros que se mandan al guardar", () => {
  it("normaliza por tipo", () => {
    expect(normalizeParamsForSubmit("rango_fecha", { min: "2026-01-01", timezone: " " })).toEqual({ min: "2026-01-01", timezone: "America/Lima" });
    expect(normalizeParamsForSubmit("duplicados", {})).toEqual({ missing_key_policy: "ignore_missing" });
    expect(normalizeParamsForSubmit("select_multiple_hierarchy", { hierarchy_map_text: "x", hierarchy_rows: [{ trigger: "2", required: ["1"] }] }))
      .toEqual({ hierarchy_rows: [{ trigger: "2", required: ["1"] }], hierarchy_map: { "2": ["1"] } });
    expect(normalizeParamsForSubmit("select_multiple_exclusive", { exclusive_codes: "9\n8" })).toEqual({ exclusive_codes: ["9", "8"] });
    // Un límite vacío no se convierte, pero tampoco se quita: viaja como "" (así guarda hoy).
    expect(normalizeParamsForSubmit("select_multiple_cardinality", { min: "1", max: "" })).toEqual({ min: 1, max: "" });
    expect(normalizeParamsForSubmit("select_multiple_cardinality", { min: "1", max: "x" })).toEqual({ min: 1, max: "x" });
    expect(normalizeParamsForSubmit("select_multiple_selection", { codes: "1, 2" })).toEqual({ op: "contains_any", codes: ["1", "2"] });
    const tal = { min: "16" };
    expect(normalizeParamsForSubmit("rango_num", tal)).toBe(tal);
  });

  it("paramList acepta lista, texto con comas o saltos y escalar", () => {
    expect(paramList([" a", "", 2])).toEqual(["a", "2"]);
    expect(paramList("a,b\nc")).toEqual(["a", "b", "c"]);
    expect(paramList(null)).toEqual([]);
    expect(paramList(5)).toEqual(["5"]);
  });

  it("el nombre sugerido es el tipo y sus preguntas", () => {
    const rango = TIPOS.find((t) => t.key === "rango_num") ?? null;
    expect(nombreSugerido(rango, ["edad"])).toBe("Valor fuera de rango: edad");
    expect(nombreSugerido(null, [])).toBe("Criterio");
  });
});

describe("modeloRegla: condición previa", () => {
  it("valida cada condición", () => {
    expect(validateGateConditions([])).toBe("");
    expect(validateGateConditions([{ variable: "", op: "==", value: "1" }])).toBe("Cada condición debe tener variable.");
    expect(validateGateConditions([{ variable: "x", op: "==", value: "" }])).toBe("Cada condición debe tener valor u opción.");
  });

  it("escribe la expresión ODK de cada operador", () => {
    expect(gateConditionToExpr({ variable: "q", op: "contains", value: "1" })).toBe('selected(${q}, "1")');
    expect(gateConditionToExpr({ variable: "q", op: "contains_none", value: ["1", "2"] })).toBe('not(selected(${q}, "1")) and not(selected(${q}, "2"))');
    expect(gateConditionToExpr({ variable: "s", op: "not_in", value: ["1", "2"] })).toBe('not_in(${s}, "1", "2")');
    expect(gateConditionToExpr({ variable: "e", op: "==", value: 'a"b' })).toBe('${e} = "a\\"b"');
    expect(gateExprFromConditions([
      { variable: "e", op: ">=", value: "18" },
      { variable: "s", op: "in", value: [] },
    ])).toBe('${e} >= "18"');
  });

  it("los operadores dependen del tipo de la pregunta", () => {
    expect(operatorOptionsForVariable(variable("sm"))[0].value).toBe("contains");
    expect(operatorOptionsForVariable(variable("so")).map((o) => o.label)).toContain("no es ninguna de");
    expect(operatorOptionsForVariable(variable("num")).map((o) => o.value)).toContain("<=");
    expect(operatorOptionsForVariable(variable("texto")).map((o) => o.value)).not.toContain(">");
  });
});

describe("modeloRegla: tratamiento previsto", () => {
  it("cada tipo tiene su tratamiento por defecto, y está entre los que ofrece", () => {
    for (const t of TIPOS) {
      const porDefecto = treatmentDefaultFor(t.key);
      expect(treatmentActionsForTipo(t.key).map((a) => a.value), t.key).toContain(porDefecto.action);
    }
    expect(treatmentDefaultFor("duplicados")).toEqual({ action: "exclude_cases", scope: "selected" });
    expect(treatmentDefaultFor(null)).toEqual({ action: "ignore_rule", scope: "single" });
  });

  it("un valor desconocido cae en el de reserva", () => {
    expect(normalizeTreatmentAction("borrar_todo", "ignore_rule")).toBe("ignore_rule");
    expect(normalizeTreatmentAction("exclude_cases", "ignore_rule")).toBe("exclude_cases");
    expect(normalizeTreatmentScope("algunos", "all")).toBe("all");
    expect(normalizeTreatmentScope("single", "all")).toBe("single");
  });
});
