import { describe, expect, it } from "vitest";
import type { CriteriosCatalogo, CriteriosSeleccionMarco } from "../../../../../api/client";
import { seleccionCanonica } from "../../../dominio";
import { planPresetCanonico } from "../presetCanonicoModel";

const catalogo: CriteriosCatalogo = {
  schema: "calc_muestra_criterios_catalogo_v1",
  variables: [
    {
      id: "session_type",
      scope: "aula",
      label: "Tipo de curso",
      kind: "flat",
      categories: [
        { key: "teorico", label: "TEÓRICO", aulas: 120 },
        { key: "laboratorio", label: "LABORATORIO", aulas: 40 },
        { key: "seminario", label: "SEMINARIO", aulas: 12 },
        { key: "tesis_1", label: "TESIS 1", aulas: 6 },
      ],
    },
    {
      id: "faculty",
      scope: "alumno",
      label: "Facultad",
      kind: "flat",
      estratifica: true,
      categories: [
        { key: "derecho", label: "DERECHO", aulas: 60 },
        { key: "ciencias", label: "CIENCIAS", aulas: 80 },
      ],
    },
    {
      id: "age",
      scope: "alumno",
      label: "Edad",
      kind: "numeric",
      numericRange: { min: 16, max: 60 },
    },
  ],
};

describe("planPresetCanonico — precarga del borrador (no confirma nada)", () => {
  it("proyecta la selección canónica al borrador y deja pendientes las variables que difieren", () => {
    const confirmada: CriteriosSeleccionMarco = { byVariable: {} };
    const plan = planPresetCanonico(catalogo, confirmada);

    // El tipo de curso excluye seminario/tesis (criterios HST 2025).
    expect(plan.seleccion.byVariable.session_type?.categories).toEqual(["teorico", "laboratorio"]);
    // La edad precarga el umbral canónico de mayoría de edad.
    expect(plan.seleccion.byVariable.age?.threshold).toEqual({ op: ">=", min: 18 });
    // Facultad no reconoce canónico: todo incluido (no filtra).
    expect(plan.seleccion.byVariable.faculty?.categories).toEqual(["derecho", "ciencias"]);

    // Todas quedan pendientes de CONFIRMAR (flujo por variable de ADR 0035).
    expect(new Set(plan.pendientes)).toEqual(new Set(["session_type", "faculty", "age"]));

    // La selección CONFIRMADA no se muta: la precarga vive solo en el plan.
    expect(confirmada).toEqual({ byVariable: {} });
    expect(plan.seleccion).not.toBe(confirmada);
  });

  it("resume en la mini-lista qué restringe y qué no", () => {
    const plan = planPresetCanonico(catalogo, { byVariable: {} });
    const porId = new Map(plan.items.map((item) => [item.variableId, item]));
    expect(porId.get("session_type")).toMatchObject({ restringe: true, detalle: "2 de 4 categorías" });
    expect(porId.get("faculty")).toMatchObject({ restringe: false });
    expect(porId.get("age")).toMatchObject({ restringe: true, detalle: "≥ 18" });
  });

  it("si lo confirmado ya coincide con el canónico no queda nada pendiente (idempotente)", () => {
    const confirmada = seleccionCanonica(catalogo);
    const plan = planPresetCanonico(catalogo, confirmada);
    expect(plan.pendientes).toEqual([]);
  });

  it("preserva courseLevelRanges y minEligible confirmados sin tocarlos", () => {
    const confirmada: CriteriosSeleccionMarco = {
      byVariable: {},
      courseLevelRanges: { derecho: [[3, 10]] },
      minEligible: { threshold: 12 },
    };
    const plan = planPresetCanonico(catalogo, confirmada);
    expect(plan.seleccion.courseLevelRanges).toEqual({ derecho: [[3, 10]] });
    expect(plan.seleccion.minEligible).toEqual({ threshold: 12 });
  });

  it("catálogo ausente produce un plan vacío sin pendientes", () => {
    const plan = planPresetCanonico(null, { byVariable: {} });
    expect(plan.pendientes).toEqual([]);
    expect(plan.items).toEqual([]);
  });
});
