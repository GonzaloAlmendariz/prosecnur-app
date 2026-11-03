import { describe, expect, it } from "vitest";

import type { TerritorialResponseAuditRow } from "../../../../../api/monitoreo";
import { construirCasosDelMapa } from "./mapaDeCasosModelo";
import { avancePorZona, celdaMasAtrasada, ejesDeLaMatriz, faltantePorCelda, type AvancePorZona, type Zona } from "./porZonaModelo";
import { observacionConcentrada } from "./ZonasConEquipo";

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

const zona = (id: string, celdas: Array<[string, string, number, number]>, extra: Partial<Zona> = {}): Zona => ({
  idZona: id, nombre: id, meta: celdas.reduce((s, c) => s + c[2], 0), efectivas: celdas.reduce((s, c) => s + c[3], 0),
  enObservacion: 0, celdasCompletas: celdas.filter((c) => c[3] >= c[2]).length, personas: [], equipo: [], sinCodigo: 0,
  diario: [], duracionMedianaMin: null,
  celdas: celdas.map(([sexo, rangoEdad, meta, efectivas]) => ({ sexo, rangoEdad, meta, efectivas, enObservacion: 0, falta: Math.max(0, meta - efectivas) })),
  ...extra,
});

describe("lo que falta por celda", () => {
  const modelo: AvancePorZona = {
    meta: 0, efectivas: 0, celdas: 4, celdasCompletas: 1, sinZona: 0, sinCelda: 0,
    zonas: [
      zona("A", [["Mujer", "18-29", 10, 6], ["Hombre", "30-44", 10, 15]]),
      zona("B", [["Mujer", "18-29", 10, 8], ["Hombre", "30-44", 10, 9]]),
    ],
  };

  it("suma la falta entre zonas sin que el exceso de una cubra a otra", () => {
    expect(faltantePorCelda(modelo)).toEqual([
      { sexo: "Mujer", rangoEdad: "18-29", falta: 6, zonas: 2 },
      { sexo: "Hombre", rangoEdad: "30-44", falta: 1, zonas: 1 },
    ]);
  });

  it("la celda más atrasada es la de menor logro sobre su cuota total", () => {
    expect(celdaMasAtrasada(modelo)).toEqual({ sexo: "Mujer", rangoEdad: "18-29", efectivas: 14, meta: 20 });
  });

  it("lee el equipo, el ritmo y la duración de cada zona", () => {
    const m = avancePorZona({
      kind: "cuotas", total: {}, zonas: [{
        id_zona: "1", celdas: [], personas: [],
        equipo: { personas: [{ codigo: "P101", efectivas: [3], dias: 2, en_observacion: 1 }], sin_codigo: 1 },
        diario: { dias: [{ fecha: "2026-06-13", efectivas: 2 }], sin_fecha: 0 },
        duracion_mediana_min: [12.5],
      }],
    });
    expect(m?.zonas[0].equipo).toEqual([{ codigo: "P101", nombre: "", efectivas: 3, dias: 2, enObservacion: 1 }]);
    expect(m?.zonas[0].sinCodigo).toBe(1);
    expect(m?.zonas[0].diario).toEqual([{ fecha: "2026-06-13", efectivas: 2 }]);
    expect(m?.zonas[0].duracionMedianaMin).toBe(12.5);
  });

  it("nombra a quien concentra la observación y dónde", () => {
    const zonas = [
      zona("SMP", [], { enObservacion: 30, equipo: [{ codigo: "P749", nombre: "", efectivas: 56, dias: 9, enObservacion: 20 }, { codigo: "P824", nombre: "", efectivas: 36, dias: 7, enObservacion: 6 }] }),
      zona("LO", [], { enObservacion: 15, equipo: [{ codigo: "P749", nombre: "", efectivas: 39, dias: 4, enObservacion: 11 }] }),
    ];
    expect(observacionConcentrada(zonas)).toEqual({ codigo: "P749", casos: 31, total: 45, donde: [{ zona: "SMP", casos: 20 }, { zona: "LO", casos: 11 }] });
  });
});

describe("casos del mapa por cuotas", () => {
  const fila = (o: Partial<TerritorialResponseAuditRow>) => ({ ubigeo: "150103", lat: -12.05, lon: -76.9, observation_status: "sin_observacion", advance_valid: true, ...o }) as TerritorialResponseAuditRow;

  it("separa los tres estados y declara los casos sin GPS en lugar de perderlos", () => {
    const d = construirCasosDelMapa([
      fila({}),
      fila({ observation_status: "en_observacion" }),
      fila({ observation_status: "en_observacion", lat: null, lon: null }),
      fila({ ubigeo: "", observation_status: "no_valida", advance_valid: false }),
    ], ["150103"]);
    expect(d.total).toEqual({ cuentan: 3, observacion: 2, noCuentan: 1 });
    expect(d.conGps).toEqual({ cuenta: 1, observacion: 1, "no-cuenta": 1 });
    expect(d.sinGps).toEqual({ total: 1, observacion: 1, noCuenta: 0 });
    expect(d.porZona).toEqual([{ ubigeo: "150103", conGps: 2, enObservacion: 1, cuentan: 3 }]);
    expect(d.casos).toHaveLength(3);
  });
});
