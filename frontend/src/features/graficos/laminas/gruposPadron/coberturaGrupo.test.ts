// X5: la cobertura de cada grupo frente a su padrón, a la vista junto al padrón, con la regla del motor
// (`.contraste_base_texto`): la cobertura nunca va en la nota de la base; una n mayor que el padrón no la lleva.
import { describe, expect, it } from "vitest";
import { baseDeGrupo, coberturaDeGrupo, textoCobertura } from "./modeloGruposPadron";

describe("coberturaDeGrupo", () => {
  it("con padrón confiable, la cobertura que va en la base", () => {
    const c = coberturaDeGrupo(91, { valor: 103, confiable: true });
    expect(c).toEqual({ tipo: "en-base", n: 91, padron: 103, pct: 88 });
    expect(textoCobertura(c!)).toBe("Cobertura 88%");
    expect(baseDeGrupo(91, { valor: 103, confiable: true })).toBe("91 (88%)");
  });

  it("con el padrón no confiable, la cobertura se ve y lo dice", () => {
    const c = coberturaDeGrupo(91, { valor: 103, confiable: false });
    expect(textoCobertura(c!)).toBe("Cobertura 88%, padrón no confiable");
    expect(baseDeGrupo(91, { valor: 103, confiable: false })).toBe("91");
  });

  it("una n mayor que el padrón no lleva cobertura", () => {
    const c = coberturaDeGrupo(1234, { valor: 1000, confiable: true });
    expect(c?.tipo).toBe("supera");
    expect(textoCobertura(c!)).toBe("1,234 supera el padrón (1,000)");
  });

  it("sin n o sin padrón no hay cobertura que mostrar", () => {
    expect(coberturaDeGrupo(null, { valor: 100, confiable: true })).toBeNull();
    expect(coberturaDeGrupo(40, { valor: null, confiable: true })).toBeNull();
  });
});
