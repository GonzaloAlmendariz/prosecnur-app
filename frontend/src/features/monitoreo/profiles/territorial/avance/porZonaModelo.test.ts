import { describe, expect, it } from "vitest";

import { avancePorZona, ejesDeLaMatriz } from "./porZonaModelo";

// ADR 0125 A1: el avance por cuotas que publica el motor, normalizado.
describe("avance por zona", () => {
  const crudo = {
    kind: ["cuotas"],
    total: { meta: 6, efectivas: 5, celdas: 3, celdas_completas: 1 },
    sin_zona: 1, sin_celda: [2],
    zonas: [{
      id_zona: "150101", ubigeo: "150101", nombre: "Lima", meta: 4, efectivas: 5, en_observacion: 1, celdas_completas: 1,
      celdas: [
        { sexo: "Hombre", rango_edad: "18 a 29", meta: 2, efectivas: 2, en_observacion: 1, falta: 0 },
        { sexo: "Mujer", rango_edad: "60 o más", meta: 2, efectivas: 1, en_observacion: 0, falta: 1 },
      ],
      personas: [{ codigo: "P101", parte: 3, efectivas: 3, falta: 0 }],
    }],
  };

  it("normaliza lo que serializa Plumber y deja la matriz con sus ejes", () => {
    const m = avancePorZona(crudo);
    expect(m?.efectivas).toBe(5);
    expect(m?.sinCelda).toBe(2);
    expect(m?.zonas[0].celdas[1].falta).toBe(1);
    expect(m?.zonas[0].personas[0]).toEqual({ codigo: "P101", parte: 3, efectivas: 3, falta: 0 });
    expect(ejesDeLaMatriz(m!.zonas[0])).toEqual({ sexos: ["Hombre", "Mujer"], rangos: ["18 a 29", "60 o más"] });
  });

  it("un reporte sin cuotas (envío por UMP o corte anterior) no tiene avance por zona", () => {
    expect(avancePorZona(undefined)).toBeNull();
    expect(avancePorZona({ kind: "ump" })).toBeNull();
  });
});
