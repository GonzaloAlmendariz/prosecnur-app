import { describe, expect, it } from "vitest";
import {
  debePedirPropuesta,
  identidadDelPlan,
  motivoArmarDesdeDeshabilitado,
  propuestaOtros,
  scopeRulesConIdentidad,
} from "./aplicarPlanSugerido";

describe("armarDesde · reglas puras", () => {
  // ADR 0096 decisión 9: «Armar desde…» se habilita en el informe compartido y se retira el motivo provisional de la
  // decisión 17. Antes este test fijaba el motivo literal y «nunca se pide la propuesta» (comportamiento provisional).
  // Mata: dejar el compartido deshabilitado o con un motivo residual.
  it("consolidado: sin motivo y la propuesta se pide al abrir, igual que en la base activa", () => {
    expect(motivoArmarDesdeDeshabilitado("consolidated")).toBeNull();
    expect(motivoArmarDesdeDeshabilitado("active")).toBeNull();
    expect(debePedirPropuesta(true, motivoArmarDesdeDeshabilitado("consolidated"))).toBe(true);
    expect(debePedirPropuesta(false, motivoArmarDesdeDeshabilitado("consolidated"))).toBe(false);
    expect(debePedirPropuesta(true, null)).toBe(true);
    expect(debePedirPropuesta(false, null)).toBe(false);
  });

  it("identidad: sólo lo que el plan trae; sin nada, null y las reglas intactas", () => {
    expect(identidadDelPlan({}, "auto")).toBeNull();
    expect(identidadDelPlan({ template_id: "t" }, "acnur_kobo_cruncher_plus"))
      .toEqual({ profile_id: "acnur_kobo_cruncher_plus", template_id: "t" });
    const reglas = { global: { a: 1 }, otra: true };
    expect(scopeRulesConIdentidad(reglas, null)).toBe(reglas);
    expect(scopeRulesConIdentidad(reglas, { b: 2 })).toEqual({ global: { a: 1, b: 2 }, otra: true });
  });

  // Mata: aplicar el «Otros» del plan sin avisar (la propuesta se muestra sólo si difiere).
  it("«Otros» del plan: se propone sólo si es booleano y distinto del interruptor", () => {
    expect(propuestaOtros({ auto_otros_slides: true }, false)).toBe(true);
    expect(propuestaOtros({ auto_otros_slides: false }, true)).toBe(false);
    expect(propuestaOtros({ auto_otros_slides: true }, true)).toBeNull();
    expect(propuestaOtros({}, false)).toBeNull();
  });
});
