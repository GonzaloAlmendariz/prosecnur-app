import { describe, expect, it } from "vitest";
import { construirResumen } from "./resumenModel";
import { CORTE_DE_RESUMEN as CORTE } from "./fixtures/corteDeResumen";

describe("Avance › Resumen", () => {
  const modelo = construirResumen(CORTE);

  it("una sola cifra con su base: cuentan frente a la meta", () => {
    expect(modelo).toMatchObject({ cuentan: 37, meta: 36, avance: "103 %", proporcion: 1 });
  });

  it("el embudo va de lo recibido a lo que cuenta y cuadra", () => {
    expect(modelo.embudo.map((paso) => [paso.clave, paso.valor])).toEqual([
      ["recibidas", 50], ["anuladas", 10], ["corte", 40], ["no-cuentan", 3], ["cuentan", 37], ["observacion", 5], ["sin-observacion", 32],
    ]);
    expect(modelo.descuadre).toBe(0);
  });

  it("el ritmo ordena los días y marca el cruce de la meta", () => {
    expect(modelo.ritmo.map((dia) => [dia.rotulo, dia.acumulado])).toEqual([["13/06", 14], ["14/06", 26], ["16/06", 37]]);
    expect(modelo.metaAlcanzada).toEqual({ fecha: "16/06", acumulado: 37, excedente: 1 });
    expect([modelo.primerRegistro, modelo.ultimoRegistro, modelo.diasConCampo]).toEqual(["13/06", "16/06", 3]);
  });

  it("cuenta los motivos de observación caso por caso, con rótulo", () => {
    expect(modelo.motivos).toEqual([
      { clave: "gps_lejos", rotulo: "GPS a más de 300 m", casos: 2 },
      { clave: "duracion_corta", rotulo: "Duración menor a 5 min", casos: 1 },
      { clave: "gps_sin_gps", rotulo: "Sin GPS", casos: 1 },
    ]);
  });

  it("sin las respuestas una a una no inventa el desglose", () => {
    expect(construirResumen({ ...CORTE, response_audit: [] }).motivos).toBeNull();
  });

  it("los distritos llevan su base, sus UMP por estado y el total declara lo que no tiene distrito", () => {
    expect(modelo.distritos[0]).toMatchObject({ distrito: "San Martín de Porres", cuentan: 19, meta: 18, avance: "106 %", observacion: 3, noCuentan: 1 });
    expect(modelo.distritos[0].umps).toEqual({ completas: 0, subsanadas: 0, pendientes: 1 });
    expect(modelo.total).toMatchObject({ cuentan: 37, meta: 36, noCuentan: 3, sinDistrito: 2, umps: 3 });
  });

  it("sin avance no hay resumen", () => {
    expect(construirResumen(null).configurado).toBe(false);
  });
});
