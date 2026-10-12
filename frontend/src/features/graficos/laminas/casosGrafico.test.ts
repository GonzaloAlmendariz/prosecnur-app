import { describe, expect, it } from "vitest";
import { conOpcionCasos, opcionCasos } from "./CasosGrafico";

describe("casos junto al % de un gráfico", () => {
  it("sin decisión sigue el informe; Siempre/Nunca van a overrides y «Como el informe» los borra", () => {
    expect(opcionCasos({})).toBe("informe");
    const siempre = conOpcionCasos({ overrides: { titulo: "x" } }, "siempre");
    expect(siempre).toEqual({ overrides: { titulo: "x", mostrar_n_en_etiquetas: true } });
    expect(opcionCasos(siempre)).toBe("siempre");
    expect(opcionCasos(conOpcionCasos(siempre, "nunca"))).toBe("nunca");
    expect(conOpcionCasos(siempre, "informe")).toEqual({ overrides: { titulo: "x" } });
  });
});
