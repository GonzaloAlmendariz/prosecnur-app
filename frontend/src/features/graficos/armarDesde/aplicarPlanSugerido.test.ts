import { describe, expect, it } from "vitest";
import {
  debePedirPropuesta,
  identidadDelPlan,
  MOTIVO_ARMAR_DESDE_CONSOLIDADO,
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

  // Mata: ignorar el alcance (pedir la propuesta también en el informe compartido).
  it("consolidado: motivo literal y nunca se pide la propuesta", () => {
    expect(motivoArmarDesdeDeshabilitado("consolidated")).toBe(MOTIVO_ARMAR_DESDE_CONSOLIDADO);
    expect(MOTIVO_ARMAR_DESDE_CONSOLIDADO).toBe(
      "El informe compartido se arma desde la matriz de equivalencias de Carga; esta opción queda deshabilitada hasta conectarla.",
    );
    expect(motivoArmarDesdeDeshabilitado("active")).toBeNull();
    expect(debePedirPropuesta(true, MOTIVO_ARMAR_DESDE_CONSOLIDADO)).toBe(false);
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
