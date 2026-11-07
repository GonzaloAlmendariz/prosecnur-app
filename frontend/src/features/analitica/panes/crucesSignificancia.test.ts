import { describe, expect, test } from "vitest";
import { detalleSignificancia, formatoAlfa, subtituloSignificancia } from "./crucesSignificancia";

describe("copy de significancia de Cruces (P-A9, ADR 0128)", () => {
  test("estándar: letras sobre proporciones y la prueba remite a la regla del estudio", () => {
    const texto = detalleSignificancia("estandar");
    expect(texto).toContain("proporción");
    expect(texto).toContain("letra");
    expect(texto).toContain("regla del estudio");
    // La prueba ya no se afirma aquí: la dice la regla.
    expect(texto).not.toMatch(/Bonferroni|Welch|prueba z/i);
  });

  test("dimensiones: promedios", () => {
    expect(detalleSignificancia("dimensiones")).toContain("promedio");
  });

  test("nunca describe asteriscos ni chi²", () => {
    for (const t of [subtituloSignificancia(), detalleSignificancia("estandar"), detalleSignificancia("dimensiones")]) {
      expect(t).not.toMatch(/asterisco|chi/i);
    }
  });

  test("un alfa inválido cae al nivel de la pestaña", () => {
    expect(formatoAlfa(Number.NaN)).toBe("0.05");
    expect(formatoAlfa(2)).toBe("0.05");
    expect(formatoAlfa(0.01)).toBe("0.01");
  });
});
