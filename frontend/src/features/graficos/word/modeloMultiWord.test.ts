import { describe, expect, it } from "vitest";
import { conModoInforme, leerModoInforme, leerModoLamina } from "./modeloMultiWord";

// W6: el modo de las multiapiladas en el Word, con el contrato del motor (f134ba5ad).
describe("multiapiladas en el Word", () => {
  it("el informe es automático salvo decisión, y automático no se guarda", () => {
    expect(leerModoInforme({})).toBe("automatico");
    const w = conModoInforme({ chart_options: { ocultar_etiqueta_si_titulo: true } }, "por_barra");
    expect(w.chart_options).toEqual({ ocultar_etiqueta_si_titulo: true, multiapiladas_word: "por_barra" });
    expect(leerModoInforme(w)).toBe("por_barra");
    expect(conModoInforme(w, "automatico").chart_options).toEqual({ ocultar_etiqueta_si_titulo: true });
  });
  it("la lámina sigue al informe si no elige o si el valor no es válido", () => {
    expect(leerModoLamina({})).toBe("");
    expect(leerModoLamina({ word_multiapiladas: "x" })).toBe("");
    expect(leerModoLamina({ word_multiapiladas: "un_grafico" })).toBe("un_grafico");
  });
});
