import { describe, expect, it } from "vitest";
import type { CalcMuestraAulasState, CriteriosSeleccionMarco } from "../../../../../api/client";
import { marcoCriteriosDesactualizado } from "../frame";

// La selección que el frame ECHA desde el backend viene verbosa (fromValue "NA",
// layer null, threshold {}, includeValues [], exceptions []); la del frontend es
// lean. No deben leerse como "desactualizado" si el contenido con significado es
// el mismo — si no, la franja queda en "reconstruye" para siempre tras sanear.
const teacherBackend = {
  scope: "aula",
  kind: "hierarchical",
  mode: "include",
  match: "any",
  categories: ["docente_contratado_contratado", "docente_ordinario_principal"],
  exceptions: [],
  threshold: {},
  includeValues: [],
  fromValue: "NA",
  layer: null,
};
const teacherLean = {
  mode: "include",
  match: "any",
  categories: ["docente_contratado_contratado", "docente_ordinario_principal"],
};

function frameCon(sel: unknown): CalcMuestraAulasState["frame"] {
  return { criterios_seleccion: { byVariable: { teacher_type: sel } } } as unknown as CalcMuestraAulasState["frame"];
}

describe("marcoCriteriosDesactualizado", () => {
  it("verbose del backend vs lean del frontend con el mismo contenido → NO desactualizado", () => {
    const config = { byVariable: { teacher_type: teacherLean } } as unknown as CriteriosSeleccionMarco;
    expect(marcoCriteriosDesactualizado(frameCon(teacherBackend), config)).toBe(false);
  });

  it("categorías realmente distintas → SÍ desactualizado", () => {
    const config = {
      byVariable: { teacher_type: { ...teacherLean, categories: ["docente_contratado_contratado"] } },
    } as unknown as CriteriosSeleccionMarco;
    expect(marcoCriteriosDesactualizado(frameCon(teacherBackend), config)).toBe(true);
  });

  it("frame sin selección registrada → no afirma desactualizado", () => {
    const config = { byVariable: { teacher_type: teacherLean } } as unknown as CriteriosSeleccionMarco;
    expect(marcoCriteriosDesactualizado(frameCon(undefined) && ({} as CalcMuestraAulasState["frame"]), config)).toBe(false);
    expect(marcoCriteriosDesactualizado(null, config)).toBe(false);
  });

  it("fromValue real distinto de 'NA' sí cuenta como cambio", () => {
    const frameCiclo = frameCon({ mode: "include", includeValues: [], fromValue: 3 });
    const configCiclo = { byVariable: { teacher_type: { mode: "include", fromValue: "NA" } } } as unknown as CriteriosSeleccionMarco;
    expect(marcoCriteriosDesactualizado(frameCiclo, configCiclo)).toBe(true);
  });

  it("match:'any' del backend vs config lean sin match → NO desactualizado (caso real HST_UNSA2)", () => {
    // El motor estampa match:"any" en TODA variable flat (formation, condition…);
    // normalizeUniversityAulasConfig no lleva match. Antes esto quedaba en
    // "reconstruye" perpetuo por comparar "any" contra ausente.
    const frameFlat = frameCon({
      scope: "alumno", kind: "flat", mode: "include", match: "any",
      categories: "pregrado", exceptions: [], threshold: null,
      includeValues: [], fromValue: "NA", layer: "marco",
    });
    const configFlat = {
      byVariable: { teacher_type: { mode: "include", categories: ["pregrado"], layer: "marco" } },
    } as unknown as CriteriosSeleccionMarco;
    expect(marcoCriteriosDesactualizado(frameFlat, configFlat)).toBe(false);
  });

  it("match:'all' (no-default) sí se compara: 'all' en frame vs config sin match → SÍ desactualizado", () => {
    const frameAll = frameCon({ mode: "include", match: "all", categories: ["a", "b"] });
    const configAny = {
      byVariable: { teacher_type: { mode: "include", categories: ["a", "b"] } },
    } as unknown as CriteriosSeleccionMarco;
    expect(marcoCriteriosDesactualizado(frameAll, configAny)).toBe(true);
  });
});

// ADR 0035: reordenar la jerarquía de docente reetiqueta el teacher_type_top de
// cada curso-horario, así que el marco vigente queda obsoleto. El frame guarda el
// orden EFECTIVO con que se construyó (frame.teacher_type_orden).
function frameConOrden(orden: unknown): CalcMuestraAulasState["frame"] {
  return { teacher_type_orden: orden } as unknown as CalcMuestraAulasState["frame"];
}

describe("marcoCriteriosDesactualizado — orden de jerarquía de docente", () => {
  const sinCriterios = null;

  it("mismo orden ⇒ NO desactualizado", () => {
    const orden = ["ordinario_principal", "ordinario_asociado", "contratado"];
    expect(marcoCriteriosDesactualizado(frameConOrden(orden), sinCriterios, [...orden])).toBe(false);
  });

  it("orden distinto ⇒ SÍ desactualizado", () => {
    const frameOrden = ["ordinario_principal", "ordinario_asociado", "contratado"];
    const configOrden = ["contratado", "ordinario_principal", "ordinario_asociado"];
    expect(marcoCriteriosDesactualizado(frameConOrden(frameOrden), sinCriterios, configOrden)).toBe(true);
  });

  it("distinta cantidad de tipos ⇒ SÍ desactualizado", () => {
    const frameOrden = ["ordinario_principal", "contratado"];
    const configOrden = ["ordinario_principal", "ordinario_asociado", "contratado"];
    expect(marcoCriteriosDesactualizado(frameConOrden(frameOrden), sinCriterios, configOrden)).toBe(true);
  });

  it("frame sin el campo (marco viejo) ⇒ NO desactualizado aunque el config tenga orden", () => {
    const frameViejo = { criterios_seleccion: { byVariable: {} } } as unknown as CalcMuestraAulasState["frame"];
    expect(marcoCriteriosDesactualizado(frameViejo, sinCriterios, ["contratado", "ordinario_principal"])).toBe(false);
  });

  it("config sin orden (el usuario nunca reordenó) ⇒ NO desactualizado aunque el frame guarde el orden por defecto", () => {
    // Caso real HST_UNSA2: el motor guarda el orden efectivo (8 tipos por defecto)
    // pero el workspace no tiene teacher_type_orden. [] vs 8 no es un cambio real.
    const frameOrden = [
      "docente_ordinario_principal",
      "docente_ordinario_asociado",
      "docente_ordinario_auxiliar",
      "docente_ordinario",
      "docente_contratado",
      "docente_extraordinario",
      "pre_docente",
      "jefe_de_practica",
    ];
    expect(marcoCriteriosDesactualizado(frameConOrden(frameOrden), sinCriterios, undefined)).toBe(false);
    expect(marcoCriteriosDesactualizado(frameConOrden(frameOrden), sinCriterios, [])).toBe(false);
  });

  it("compara semánticamente: dedup y trim no cuentan como cambio", () => {
    const frameOrden = ["ordinario_principal", "contratado"];
    const configOrden = [" ordinario_principal ", "contratado", "contratado", ""];
    expect(marcoCriteriosDesactualizado(frameConOrden(frameOrden), sinCriterios, configOrden)).toBe(false);
  });
});
