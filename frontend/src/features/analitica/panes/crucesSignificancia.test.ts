import { describe, expect, test } from "vitest";
import { ALFA_CRUCES, detalleSignificancia, formatoAlfa, subtituloSignificancia } from "./crucesSignificancia";

describe("copy de significancia de Cruces (P-A9)", () => {
  test("estándar: z de proporciones, Bonferroni, letras y el nivel que se envía", () => {
    const texto = detalleSignificancia("estandar", ALFA_CRUCES);
    expect(texto).toContain("Prueba z de diferencia de proporciones");
    expect(texto).toContain("Bonferroni");
    expect(texto).toContain("nivel de significancia 0.05");
    expect(texto).toContain("letra");
    expect(texto).toContain("cluster-robust");
  });

  test("dimensiones: t de Welch sobre promedios", () => {
    const texto = detalleSignificancia("dimensiones", 0.1);
    expect(texto).toContain("t de Welch");
    expect(texto).toContain("promedio");
    expect(texto).toContain("nivel de significancia 0.1");
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
