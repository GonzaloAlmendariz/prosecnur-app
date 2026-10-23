import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { construirFaltante } from "./faltanteModel";
import { construirUmps, csvDeUmps, filtrarUmps } from "./umpsModel";
import { CORTE_DE_CUOTAS } from "./fixtures/corteDeCuotas";

const CON_PARTE = {
  ...CORTE_DE_CUOTAS,
  advance: {
    ...CORTE_DE_CUOTAS.advance,
    block_progress: [{ id_manzana: "150135063000590", revision: 2 }],
  },
  field_occurrences: {
    by_ump: [
      { ump: "UMP 143", has_report: true, reportes: 2, efectivas: 8, intentos: 20 },
      { ump: "7", has_report: false, reportes: 0, efectivas: 0, intentos: 0 },
    ],
  },
} as unknown as MonitoreoTerritorialDashboard;

describe("Avance › UMP", () => {
  const modelo = construirUmps(CON_PARTE);

  it("lee la misma base que Faltante por UMP: cuentan, cuota y estado coinciden", () => {
    const faltante = construirFaltante(CON_PARTE);
    for (const fila of modelo.filas) {
      const misma = faltante.filas.find((item) => item.ump === fila.ump);
      expect([fila.cuentan, fila.meta, fila.estado]).toEqual([misma?.logrado, misma?.meta, misma?.estado]);
    }
  });

  it("pendientes primero, con la falta en la cuota y las observaciones de su manzana", () => {
    expect(modelo.filas.map((fila) => fila.ump)).toEqual(["143", "7", "35"]);
    expect(modelo.filas[0]).toMatchObject({ tipo: "Titular", cuota: "Falta 1", observacion: 2 });
    expect(modelo.filas[1]).toMatchObject({ tipo: "Reemplazo", cuota: "Completa con subsanación" });
  });

  it("con parte de ocurrencias suma efectivas e intentos y marca las UMP sin parte", () => {
    expect(modelo.conOcurrencias).toBe(true);
    expect(modelo.filas[0].parte).toEqual({ efectivas: 8, intentos: 20, tasa: "40 %" });
    expect(modelo.filas.filter((fila) => fila.sinParte).map((fila) => fila.ump)).toEqual(["7", "35"]);
    expect(modelo.conteos).toEqual({ todas: 3, pendientes: 1, subsanadas: 1, completas: 1, "sin-parte": 2 });
  });

  it("sin ocurrencias declaradas (E4) no hay parte ni filtro «Sin parte»", () => {
    const sin = construirUmps(CORTE_DE_CUOTAS);
    expect(sin.conOcurrencias).toBe(false);
    expect(sin.filas.every((fila) => fila.parte === null && !fila.sinParte)).toBe(true);
    expect(sin.conteos["sin-parte"]).toBe(0);
  });

  it("filtra por estado y busca sin tildes por UMP, distrito o aplicador", () => {
    expect(filtrarUmps(modelo.filas, "subsanadas").map((fila) => fila.ump)).toEqual(["7"]);
    expect(filtrarUmps(modelo.filas, "todas", "martin").map((fila) => fila.ump)).toEqual(["143"]);
    expect(filtrarUmps(modelo.filas, "todas", "ump 35").map((fila) => fila.ump)).toEqual(["35"]);
  });

  it("el CSV lleva las columnas de la tabla y escapa lo que hace falta", () => {
    const csv = csvDeUmps(modelo.filas.slice(0, 1), true).split("\n");
    expect(csv[0]).toBe("UMP,Distrito,Manzana,Tipo,Aplicador,Cuentan,Meta,En observación,Cuota,Efectivas,Intentos,Tasa efectiva");
    expect(csv[1]).toBe("143,San Martín de Porres,0590,Titular,P132 · Aplicadora de Prueba,8,8,2,Falta 1,8,20,40 %");
    expect(csvDeUmps(modelo.filas.slice(0, 1), false).split("\n")[0].endsWith("Cuota")).toBe(true);
  });
});
