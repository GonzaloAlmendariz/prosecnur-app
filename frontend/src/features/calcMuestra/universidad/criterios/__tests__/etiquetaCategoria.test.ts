import { describe, expect, it } from "vitest";
import { analizarEtiquetaCategoria } from "../etiquetaCategoria";

describe("T1 · una categoría es una sola cosa", () => {
  it("declara los valores que esconde una etiqueta agrupada por la fuente", () => {
    // Los dos casos literales del catálogo del proyecto de referencia.
    expect(analizarEtiquetaCategoria("TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)"))
      .toEqual({
        base: "TEORICO",
        agrupadas: ["TEORICO", "TEORICO-PRACTICO", "TEORICO-LABORATORIO"],
      });

    const ingreso = analizarEtiquetaCategoria("INGRESO(EV.TAL,1OP,CEPR,ITS,PAEE,BACH,EX.ING)");
    expect(ingreso.base).toBe("INGRESO");
    expect(ingreso.agrupadas).toHaveLength(8);
    expect(ingreso.agrupadas).toContain("EX.ING");
  });

  it("no inventa agrupaciones donde el paréntesis es parte del nombre", () => {
    for (const label of [
      "POR INCORPORACION (ESC.GRADUADOS Y DIPLOMAS)",
      "POR SER ALUMNO DE LA ESC.ED ESTUDIOS ESPECI",
      "PREGRADO",
      "CIENCIAS Y ARTES DE LA COMUN.",
    ]) {
      expect(analizarEtiquetaCategoria(label)).toEqual({ base: label, agrupadas: [] });
    }
  });

  it("lee una lista sin base como lo que es", () => {
    expect(analizarEtiquetaCategoria("ARTES, DISEÑO")).toEqual({
      base: "ARTES",
      agrupadas: ["ARTES", "DISEÑO"],
    });
  });

  it("tolera vacío sin romperse", () => {
    expect(analizarEtiquetaCategoria("")).toEqual({ base: "", agrupadas: [] });
  });
});
