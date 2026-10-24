/**
 * Rondas de supervisión (T9): el reparto previo del diálogo «Nueva ronda», el
 * error en palabras y la lectura de los bloques y de la API.
 */
import { describe, expect, it } from "vitest";
import { ApiError } from "../../../../../api/core";
import { normalizarRondasDeSupervision } from "../../../../../api/monitoreoTelefonico";
import type { MonitoreoAcreditacionReports, MonitoreoSource } from "../../../../../api/client";
import {
  baseDeSupervision,
  casosDeRondaApi,
  avisosDeSupervision,
  efectivasSinRonda,
  hojaDeSupervision,
  mensajeDeError,
  repartoDeRondaApi,
  repartoPrevio,
  rondasDesdeApi,
  rondasDesdeBloques,
} from "./rondasModel";

function reportes(bloques: Record<string, Array<Record<string, unknown>>>): MonitoreoAcreditacionReports {
  return {
    schema: "test", generated_at: "2026-10-24T10:00:00", reference_tabs: [],
    sheets: [{ id: "monitoreo_telefonico", title: "Telefónico", blocks: Object.entries(bloques).map(([id, rows]) => ({ id, title: id, columns: [], rows })) }],
  } as unknown as MonitoreoAcreditacionReports;
}

describe("repartoPrevio", () => {
  it("reparte por mayor resto, con al menos uno por enumerador y nunca más que sus efectivas", () => {
    const r = repartoPrevio(new Map([["Ana", 12], ["Beto", 6], ["Cira", 1], ["Dino", 0]]), 10);
    // 10 % de 19 = 2 casos declarados: Ana 1,26 y Beto 0,63 se llevan uno cada uno; Cira sube por el mínimo.
    expect(r.filas).toEqual([
      { enumerador: "Ana", efectivas: 12, casos: 1, minimo: false },
      { enumerador: "Beto", efectivas: 6, casos: 1, minimo: false },
      { enumerador: "Cira", efectivas: 1, casos: 1, minimo: true },
    ]);
    expect(r.casos).toBe(3);
  });

  it("al 100 % sale cada efectiva y ninguna fila sube por el mínimo", () => {
    const r = repartoPrevio(new Map([["Ana", 3], ["Beto", 2]]), 100);
    expect(r.casos).toBe(5);
    expect(r.filas.every((fila) => !fila.minimo && fila.casos === fila.efectivas)).toBe(true);
  });

  it("redondea hacia arriba como el motor (ceiling) y 0 % no sortea nada", () => {
    // 10 % de 11 = 1,1: el motor pide 2 casos, no 1.
    expect(repartoPrevio(new Map([["Ana", 6], ["Beto", 5]]), 10).casos).toBe(2);
    expect(repartoPrevio(new Map([["Ana", 6], ["Beto", 5]]), 0)).toEqual({ casos: 0, filas: [] });
  });

  it("sin efectivas no reparte nada", () => {
    expect(repartoPrevio(new Map(), 20)).toEqual({ casos: 0, filas: [] });
  });
});

describe("mensajeDeError", () => {
  it("devuelve la frase del motor sin la clave del final", () => {
    const error = new ApiError("E_MONITOREO_SUPERVISION_PUBLICADA", "La Ronda 2 ya se publicó en «Ronda 2».");
    expect(mensajeDeError(error)).toBe("La Ronda 2 ya se publicó en «Ronda 2».");
  });

  it("si sólo llegó la clave, la traduce; nunca la muestra cruda", () => {
    expect(mensajeDeError(new ApiError("E_MONITOREO_SUPERVISION_SIN_NUEVAS", ""))).toBe("No hay efectivas nuevas desde la última ronda.");
    expect(mensajeDeError(new Error("E_MONITOREO_SUPERVISION_HOJA"))).toMatch(/hoja de supervisión/);
    expect(mensajeDeError(new Error("E_ALGO_DESCONOCIDO"))).toBe("No se pudo completar la acción.");
  });
});

describe("lecturas", () => {
  const R = reportes({
    supervision_rondas: [
      { Ronda: 2, Guardada: "Sí", "Generada el": "2026-10-23T09:00:00", Semilla: 7, Porcentaje: 20, Universo: 10, Corte: "c2", Sorteados: 2, Agregados: 1, Casos: 3, "Publicada en": "Ronda 2", "Publicada el": "2026-10-23", Lectura: "pestana_borrada", "Leída el": "2026-10-24T08:00:00" },
      { Ronda: 1, Guardada: "No", Porcentaje: "", Universo: 24, Casos: 5 },
    ],
    supervision_base: [
      { CodPulso: "P1", proGres: "CGU1", Enumerador: "Ana", Ronda: 1, Disponible: false },
      { CodPulso: "P2", proGres: "", Enumerador: "", Ronda: "", Disponible: true },
      { CodPulso: "", Enumerador: "Beto" },
    ],
    supervision_resumen: [{ Indicador: "Efectivas sin ronda", Valor: 4 }],
    supervision_avisos: [{ Ronda: 2, Aviso: "La Ronda 2 se publicó en «Ronda 2», pero esa pestaña ya no está." }],
  });

  it("las rondas salen ordenadas, con estado y sin porcentaje la heredada", () => {
    const rondas = rondasDesdeBloques(R);
    expect(rondas.map((r) => [r.numero, r.guardada, r.porcentaje, r.publicadaEn])).toEqual([[1, false, null, ""], [2, true, 20, "Ronda 2"]]);
    expect(rondas[1].semilla).toBe(7);
    expect([rondas[1].lectura, rondas[0].lectura]).toEqual(["pestana_borrada", ""]);
    expect(avisosDeSupervision(R)).toEqual([{ ronda: 2, aviso: "La Ronda 2 se publicó en «Ronda 2», pero esa pestaña ya no está." }]);
    expect(avisosDeSupervision(reportes({}))).toEqual([]);
  });

  it("la base marca qué ronda eligió cada caso y descarta filas sin código", () => {
    expect(baseDeSupervision(R)).toEqual([
      { codigo: "P1", progres: "CGU1", enumerador: "Ana", categoria: "", fechaKobo: "", responseId: "", ronda: 1 },
      { codigo: "P2", progres: "", enumerador: "Sin enumerador", categoria: "", fechaKobo: "", responseId: "", ronda: null },
    ]);
    expect(efectivasSinRonda(R)).toBe(4);
    expect(efectivasSinRonda(reportes({}))).toBeNull();
  });

  it("la API se normaliza y se lee con la forma de los bloques", () => {
    const api = normalizarRondasDeSupervision([
      { numero: 3, generada_el: "2026-10-24", semilla: "11", porcentaje: 10, universo: 8, corte: "c3",
        casos: [{ N: 1, CodPulso: "P9", Enumerador: "Ana", Origen: "sorteo" }, { N: 2, CodPulso: "P8", Enumerador: "Beto", Origen: "analista" }],
        reparto: [{ Enumerador: "Ana", Efectivas: 5, Casos: 1, "Mínimo": false }, { Enumerador: "Beto", Efectivas: 3, Casos: 1, "Mínimo": true }],
        publicada: {}, resultados: { estado: ["leida"], leido_el: "2026-10-24T09:00:00", pestana: "Ronda 3", filas: [] } },
      { numero: "NA" },
      "basura",
    ]);
    expect(api).toHaveLength(1);
    expect(api[0].publicada).toBeNull();
    expect(rondasDesdeApi(api)[0]).toMatchObject({ numero: 3, guardada: true, semilla: 11, sorteados: 1, agregados: 1, casos: 2, lectura: "leida" });
    expect(casosDeRondaApi(api[0]).map((c) => [c.codigo, c.origen, c.ronda])).toEqual([["P9", "sorteo", 3], ["P8", "analista", 3]]);
    expect(repartoDeRondaApi(api[0]).map((f) => f.minimo)).toEqual([false, true]);
  });

  it("la hoja de supervisión es la fuente activa con ese rol", () => {
    const fuentes = [
      { id: "a", enabled: true, role: "barrido" },
      { id: "b", enabled: false, role: "supervision" },
      { id: "c", enabled: true, role: "supervision" },
    ] as unknown as MonitoreoSource[];
    expect(hojaDeSupervision(fuentes)?.id).toBe("c");
    expect(hojaDeSupervision([])).toBeNull();
  });
});
