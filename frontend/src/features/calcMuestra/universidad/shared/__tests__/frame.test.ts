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
});
