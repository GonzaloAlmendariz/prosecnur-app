import { describe, expect, test } from "vitest";
import { pasoSugerido, pasoVigente, pasosDelAsistente, type EstadoAsistente } from "./pasosAsistente";

const base: EstadoAsistente = { hayReferencia: false, hayFamilia: false, muestraCatalogo: false, hayAuditoria: false };

describe("pasos del asistente independiente (L6)", () => {
  test("aterriza en lo más avanzado que ya tiene contenido", () => {
    expect(pasoSugerido(base)).toBe("referencia");
    expect(pasoSugerido({ ...base, hayFamilia: true })).toBe("familia");
    expect(pasoSugerido({ ...base, hayFamilia: true, muestraCatalogo: true })).toBe("catalogo");
    expect(pasoSugerido({ ...base, muestraCatalogo: true, hayAuditoria: true })).toBe("auditar");
  });

  test("respeta el paso elegido mientras tenga qué mostrar", () => {
    const estado = { ...base, hayFamilia: true, muestraCatalogo: true };
    expect(pasoVigente("referencia", estado)).toBe("referencia");
    expect(pasoVigente("familia", estado)).toBe("familia");
  });

  test("un paso que se quedó vacío cae al sugerido, nunca a una pantalla en blanco", () => {
    expect(pasoVigente("familia", base)).toBe("referencia");
    expect(pasoVigente("catalogo", { ...base, hayFamilia: true })).toBe("familia");
  });

  test("los pasos sin contenido se ofrecen deshabilitados y dicen por qué", () => {
    const pasos = pasosDelAsistente(base);
    expect(pasos.map((p) => p.key)).toEqual(["referencia", "familia", "catalogo", "auditar"]);
    expect(pasos.filter((p) => p.disabled).every((p) => !!p.disabledReason)).toBe(true);
    expect(pasos[0].disabled).toBeFalsy();
  });
});
