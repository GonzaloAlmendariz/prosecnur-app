import { describe, expect, it } from "vitest";
import {
  debePedirPropuesta,
  identidadDelPlan,
  motivoArmarDesdeDeshabilitado,
  propuestaOtros,
  revisionAlAplicar,
  scopeRulesConIdentidad,
} from "./aplicarPlanSugerido";

describe("armarDesde · reglas puras", () => {
  // Mata: Fusionar sin grabar la revisión (contrato A5 2b) o Reemplazar que conserve un sello ajeno.
  it("revisión: reemplazar/fusionar/sincronizar según la fuente", () => {
    const equiv = { fuente: "equivalencias", revision: "r9" };
    const auto = { fuente: "auto", revision: "r9" };
    expect(revisionAlAplicar("reemplazar", equiv)).toBe("r9");
    expect(revisionAlAplicar("fusionar", equiv)).toBe("r9");
    expect(revisionAlAplicar("sincronizar", equiv)).toBe("r9");
    expect(revisionAlAplicar("reemplazar", auto)).toBe("");
    expect(revisionAlAplicar("fusionar", auto)).toBeUndefined();
  });

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

  // F2 (ADR 0096 decisión 6): en el compartido la propuesta es compuesta (`fuente: "consolidado"`) y el disparador del
  // sello es `contiene_equivalencias`, no la fuente. Mata: grabar el sello sólo cuando `fuente === "equivalencias"`.
  it("revisión: la propuesta compuesta con láminas de la matriz graba r2:x al reemplazar y al fusionar", () => {
    const compuesta = { fuente: "consolidado", contiene_equivalencias: true, revision: "r2:x" };
    expect(revisionAlAplicar("reemplazar", compuesta)).toBe("r2:x");
    expect(revisionAlAplicar("fusionar", compuesta)).toBe("r2:x");
    expect(revisionAlAplicar("sincronizar", compuesta)).toBe("r2:x");
  });

  it("revisión: la propuesta compuesta SIN láminas de la matriz no graba un sello", () => {
    const sinMatriz = { fuente: "consolidado", contiene_equivalencias: false, revision: "" };
    expect(revisionAlAplicar("reemplazar", sinMatriz)).toBe("");
    expect(revisionAlAplicar("fusionar", sinMatriz)).toBeUndefined();
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
