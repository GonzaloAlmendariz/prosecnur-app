import { describe, expect, it } from "vitest";
import type {
  CalcMuestraAulasCriterioRadiografiaV2Entry,
  CalcMuestraAulasCriteriosRadiografiaV2,
  CriterioKind,
  CriterioScope,
  CriteriosCatalogo,
} from "../../../../../api/client";
import {
  buildCriteriosRadiografiaModel,
  COMPOSITION_GATE_IDS,
  criterioCardsForScope,
} from "../criteriosRadiografiaModel";

const variables: Array<[string, CriterioScope, CriterioKind]> = [
  ["formation", "alumno", "flat"],
  ["condition", "alumno", "flat"],
  ["age", "alumno", "numeric"],
  ["faculty", "alumno", "flat"],
  ["level", "alumno", "ordinal"],
  ["modality", "aula", "flat"],
  ["session_type", "aula", "flat"],
  ["condicion_curso", "aula", "flat"],
  ["teacher_type", "aula", "hierarchical"],
  ["course_level", "aula", "range"],
  ["enrolled_total", "aula", "numeric"],
];

const catalogo: CriteriosCatalogo = {
  schema: "calc_muestra_criterios_catalogo_v1",
  variables: variables.map(([id, scope, kind]) => ({
    id,
    scope,
    kind,
    label: id,
    mappedColumn: id,
  })),
};

function noDataEntry(
  id: string,
  cardId = id,
  scope: CriterioScope = "aula",
  kind: CriterioKind | "gate" = "flat",
): CalcMuestraAulasCriterioRadiografiaV2Entry {
  if (scope === "alumno") {
    const family = kind === "numeric" ? "student_numeric" : kind === "ordinal" ? "student_ordinal" : "student_flat";
    return {
      id,
      card_id: cardId,
      label: id,
      scope: "alumno",
      family,
      owner: "calc_muestra_aulas_construir_v1.filas_alumno",
      kind: kind as "flat" | "numeric" | "ordinal",
      grain: "alumno_x_curso_horario_x_facultad",
      unit: "alumno_unico_por_curso_horario",
      gate: "poblacion",
      status: "no_aplica",
      effective_layer: "marco",
      overlap: false,
      faculty_dimension: "alumno",
      rows: [],
    } as CalcMuestraAulasCriterioRadiografiaV2Entry;
  }
  const composition = COMPOSITION_GATE_IDS.includes(id as (typeof COMPOSITION_GATE_IDS)[number]);
  const threshold = id === "minEligible";
  const gateFamily = threshold || composition;
  const family = threshold
    ? "threshold_gate"
    : composition
      ? "proportion_gate"
      : kind === "hierarchical"
        ? "classroom_hierarchical"
        : kind === "range"
          ? "classroom_range"
          : kind === "numeric" ? "classroom_numeric" : "classroom_flat";
  return {
    id,
    card_id: cardId,
    label: id,
    scope: "aula",
    family,
    owner: gateFamily ? "calc_muestra_aulas_criterios_v1" : "calc_muestra_aulas_frame_v1.aula_frame",
    kind: gateFamily ? "gate" : kind,
    grain: "curso_horario_x_facultad_x_segmento",
    unit: "curso_horario_unico",
    gate: "marco",
    status: "no_aplica",
    effective_layer: null,
    overlap: false,
    faculty_dimension: "curso_horario_efectiva",
    rows: [],
  } as CalcMuestraAulasCriterioRadiografiaV2Entry;
}

function v2(entries: CalcMuestraAulasCriterioRadiografiaV2Entry[]): CalcMuestraAulasCriteriosRadiografiaV2 {
  return {
    schema: "calc_muestra_aulas_criterios_radiografia_v2",
    owner: "calc_muestra_aulas_frame_v1.criterios_radiografia",
    frame_hash: "frame-123",
    momento: "marco_ejecutado",
    grano: "criterio_x_facultad_x_segmento",
    unidad: "curso_horario_unico",
    filas_owner: "calc_muestra_aulas_frame_v1.aula_frame",
    filas_grano: "session_type_x_facultad_efectiva",
    filas: [],
    criterios: entries,
  };
}

function exactEntries() {
  return [
    ...catalogo.variables.map((variable) => noDataEntry(variable.id, variable.id, variable.scope, variable.kind)),
    noDataEntry("minEligible", "minEligible", "aula", "gate"),
    ...COMPOSITION_GATE_IDS.map((id) => noDataEntry(id, "composition", "aula", "gate")),
  ];
}

describe("denominador de la consola F1", () => {
  it("produce catálogo + mínimo + composición: 13 cards y 15 gates", () => {
    const model = buildCriteriosRadiografiaModel({ catalogo, radiografia: v2(exactEntries()) });

    expect(model.cards).toHaveLength(13);
    expect(model.expectedGateIds).toHaveLength(15);
    expect(new Set(model.expectedCardIds).size).toBe(13);
    expect(new Set(model.expectedGateIds).size).toBe(15);
    expect(model.expectedCardIds).not.toContain("manual_excluded");
    expect(model.orphanGateIds).toEqual([]);
    expect(model.cards.find((card) => card.cardId === "composition")?.gateIds).toEqual([
      "c7",
      "c8_facultad",
      "c8",
    ]);
  });

  it("filtra por scope sin alterar el denominador", () => {
    const model = buildCriteriosRadiografiaModel({ catalogo, radiografia: null });

    expect(criterioCardsForScope(model, "alumno").map((card) => card.cardId)).toEqual([
      "formation",
      "condition",
      "age",
      "faculty",
      "level",
    ]);
    expect(criterioCardsForScope(model, "aula").map((card) => card.cardId)).toContain("enrolled_total");
  });

  it("marca composición inválida si falta uno de sus tres gates", () => {
    const entries = exactEntries().filter((entry) => entry.id !== "c8_facultad");
    const model = buildCriteriosRadiografiaModel({ catalogo, radiografia: v2(entries) });

    expect(model.cards.find((card) => card.cardId === "composition")).toMatchObject({
      state: "invalido",
    });
  });

  it("reporta gates huérfanos sin convertirlos en tarjetas", () => {
    const entries = [...exactEntries(), noDataEntry("manual_excluded")];
    const model = buildCriteriosRadiografiaModel({ catalogo, radiografia: v2(entries) });

    expect(model.orphanGateIds).toEqual(["manual_excluded"]);
    expect(model.cards.some((card) => card.cardId === "manual_excluded")).toBe(false);
  });

  it("falla cerrado si age se atribuye a student_flat", () => {
    const entries = exactEntries().map((entry) => entry.id === "age"
      ? noDataEntry("age", "age", "alumno", "flat")
      : entry);
    const model = buildCriteriosRadiografiaModel({ catalogo, radiografia: v2(entries) });

    expect(model.cards.find((card) => card.cardId === "age")?.state).toBe("invalido");
  });

  it("admite teacher_type flat cuando ese es el kind efectivo del catálogo", () => {
    const flatCatalog: CriteriosCatalogo = {
      ...catalogo,
      variables: catalogo.variables.map((variable) => variable.id === "teacher_type"
        ? { ...variable, kind: "flat" }
        : variable),
    };
    const entries = exactEntries().map((entry) => entry.id === "teacher_type"
      ? noDataEntry("teacher_type", "teacher_type", "aula", "flat")
      : entry);
    const model = buildCriteriosRadiografiaModel({ catalogo: flatCatalog, radiografia: v2(entries) });

    expect(model.cards.find((card) => card.cardId === "teacher_type")?.state).toBe("no_aplica");
  });

  it("mantiene composition en v2 si un gate está disponible y otro sin señal", () => {
    const entries = exactEntries().map((entry) => {
      if (entry.id === "c7") return { ...entry, status: "disponible" as const };
      if (entry.id === "c8_facultad") return { ...entry, status: "sin_senal" as const };
      return entry;
    });
    const model = buildCriteriosRadiografiaModel({ catalogo, radiografia: v2(entries) });

    expect(model.cards.find((card) => card.cardId === "composition")?.state).toBe("v2");
    expect(model.cards.find((card) => card.cardId === "composition")?.entries.map((entry) => entry.status)).toEqual([
      "disponible",
      "sin_senal",
      "no_aplica",
    ]);
  });

  it("colapsa ids duplicados del catálogo en una tarjeta inválida", () => {
    const duplicated: CriteriosCatalogo = {
      ...catalogo,
      variables: [...catalogo.variables, { ...catalogo.variables[0] }],
    };
    const model = buildCriteriosRadiografiaModel({ catalogo: duplicated, radiografia: null });

    expect(model.expectedCardIds.filter((id) => id === "formation")).toHaveLength(1);
    expect(model.duplicateCardIds).toEqual(["formation"]);
    expect(model.cards.find((card) => card.cardId === "formation")?.state).toBe("invalido");
  });
});
