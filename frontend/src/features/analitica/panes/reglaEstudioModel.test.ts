// Mata: la tarjeta de Cruces que inventa una prueba distinta de la regla, que no distingue propuesta de guardada, que
// enlaza a otra dirección que la canónica o que calla los 422 de la regla.
import { describe, expect, it } from "vitest";
import { REGLA_DIFERENCIAS_POR_DEFECTO } from "../../../api/graficosDiferencias";
import { DIRECCION_REGLA_ESTUDIO, filasRegla, origenRegla, textoErrorRegla } from "./reglaEstudioModel";

describe("regla del estudio en Cruces", () => {
  it("Rao-Scott con conglomerado y estrato, BH, nivel, umbral y base", () => {
    const filas = filasRegla({ ...REGLA_DIFERENCIAS_POR_DEFECTO, prueba: "rao_scott", correccion: "bh_informe", conglomerado: "seccion", estrato: "zona", umbral_puntos: 5 });
    expect(filas.map((f) => f.valor)).toEqual([
      "Rao-Scott por seccion, estrato zona",
      "Benjamini-Hochberg en todo el informe",
      "p < 0.05",
      "5 puntos",
      "30 casos por columna",
    ]);
  });
  it("la z de siempre y sin mínimo de puntos", () => {
    const filas = filasRegla({ ...REGLA_DIFERENCIAS_POR_DEFECTO, umbral_puntos: 0 });
    expect(filas[0].valor).toBe("Prueba z de diferencia de proporciones");
    expect(filas[1].valor).toBe("Bonferroni dentro de cada fila");
    expect(filas[3].valor).toBe("Sin mínimo");
  });
  it("origen: del estudio o propuesta", () => {
    expect(origenRegla("estudio")).toEqual({ rotulo: "Del estudio", propuesta: false });
    expect(origenRegla("propuesta").propuesta).toBe(true);
    expect(origenRegla(null).propuesta).toBe(true);
  });
  it("los dos 422 con su texto; otro error, su mensaje", () => {
    expect(textoErrorRegla("E_SIG_SIN_CONGLOMERADO", "")).toContain("conglomerado");
    expect(textoErrorRegla("E_SIG_ESTRATO_NO_ANIDADO", "")).toContain("estrato");
    expect(textoErrorRegla("E_X", "falló")).toBe("falló");
  });
  it("la dirección canónica del diálogo de la regla", () => {
    const url = new URL(DIRECCION_REGLA_ESTUDIO, "http://x");
    expect(url.pathname).toBe("/graficos");
    expect(url.searchParams.get("pestana")).toBe("laminas");
    expect(url.searchParams.get("panel")).toBe("diferencias-regla");
  });
});
