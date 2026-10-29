import { describe, expect, it } from "vitest";
import { normalizarMarcoElegible, normalizarMarcoElegiblePreview } from "./hojasRuta";

describe("normalizador del marco elegible (ADR 0115)", () => {
  it("sin datos es una corrida legacy: no declarado, mínimo 0, sin áreas", () => {
    expect(normalizarMarcoElegible(undefined)).toEqual({ declarado: false, minimo_viviendas: 0, areas_excluidas: [] });
  });

  it("descarta áreas con motivo desconocido o sin anillo cerrado", () => {
    const anillo = [[-77.01, -12.05], [-77, -12.05], [-77, -12.06], [-77.01, -12.05]];
    const me = normalizarMarcoElegible({
      declarado: true,
      minimo_viviendas: 2.6,
      areas_excluidas: [
        { id: "ok", motivo: "no_residencial", detalle: "Industrial", poligono: anillo },
        { id: "x", motivo: "basural", poligono: anillo },
        { id: "corto", motivo: "otro", detalle: "d", poligono: anillo.slice(0, 2) },
      ],
    });
    expect(me.minimo_viviendas).toBe(3);
    expect(me.areas_excluidas.map((a) => a.id)).toEqual(["ok"]);
  });

  it("la vista previa tolera cobertura NA, perfiles NSE como arreglos y faltas desconocidas", () => {
    const p = normalizarMarcoElegiblePreview({
      ok: true,
      por_distrito: [{ ubigeo: "150102", distrito: "ANCON", total: { manzanas: 3 }, cobertura_poblacion: "NA" }],
      nse: { elegible: { "3 Medio": [5] }, excluida: { "S/D": 2 } },
      capacidad: [{ zona: "00100", rutas: 2, manzanas: 1, necesita: 4, falta: "titulares" }, { zona: "00200", falta: "otra" }],
    });
    expect(p.por_distrito[0].cobertura_poblacion).toBeNull();
    expect(p.por_distrito[0].total).toEqual({ manzanas: 3, viviendas: 0, poblacion: 0 });
    expect(p.nse).toEqual({ elegible: { "3 Medio": 5 }, excluida: { "S/D": 2 } });
    expect(p.capacidad.map((c) => c.falta)).toEqual(["titulares", null]);
    // Una lista con nombres de R llega como objeto: también vale.
    const comoObjeto = normalizarMarcoElegiblePreview({ por_distrito: { "150102": { ubigeo: "150102", cobertura_poblacion: 0.9 } } });
    expect(comoObjeto.por_distrito.map((d) => d.ubigeo)).toEqual(["150102"]);
  });
});
