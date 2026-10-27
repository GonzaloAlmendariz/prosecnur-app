import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard, TerritorialResponseAuditRow } from "../../../../../api/client";
import { construirRecorrido, resumirJornada, tramoDeDistancia } from "./recorridoModel";

function fila(parcial: Partial<TerritorialResponseAuditRow>): TerritorialResponseAuditRow {
  return {
    row_index: 1, response_id: "r1", district_code: "", distrito: "SAN JUAN DE LURIGANCHO", ubigeo: "150132",
    consent: "1", age: 30, status: "", submitted_by: "", submission_time: "2026-06-14T11:00:00",
    duration_seconds: 600, lat: -12, lon: -77, gps_parseable: true, geo_estado: "geo_ok", distance_m: 20,
    nearest_block_id: "", nearest_block_type: "", validation_status: "validada", issues: "",
    responsible_display: "P844 · Rodríguez", submission_date_iso: "2026-06-14", submission_hour: "11:00",
    advance_block_id: "M1", advance_block_manzana: "0210", advance_block_type: "Titular", advance_block_ump: "96",
    advance_block_ubigeo: "150132",
    ...parcial,
  } as TerritorialResponseAuditRow;
}

function corte(filas: TerritorialResponseAuditRow[]): MonitoreoTerritorialDashboard {
  return { response_audit: filas } as unknown as MonitoreoTerritorialDashboard;
}

describe("Control › Recorrido", () => {
  it("un aplicador con dos manzanas en el día: cada formulario conserva SU manzana y su distancia", () => {
    const modelo = construirRecorrido(corte([
      fila({ response_id: "a", submission_time: "2026-06-14T09:00:00", submission_hour: "09:00", gps_effective_distance_m: 40 }),
      fila({ response_id: "b", submission_time: "2026-06-14T10:00:00", submission_hour: "10:00", advance_block_id: "M2", advance_block_manzana: "0350", advance_block_ump: "131", gps_effective_distance_m: 420 }),
      fila({ response_id: "c", submission_time: "2026-06-14T08:00:00", submission_hour: "08:00", gps_effective_distance_m: 180 }),
    ]));
    const jornada = modelo.aplicadores[0].jornadas[0];
    expect(jornada.formularios.map((f) => [f.orden, f.id, f.idManzana, f.tramo])).toEqual([
      [1, "c", "M1", "revision"],
      [2, "a", "M1", "cerca"],
      [3, "b", "M2", "lejos"],
    ]);
    expect(jornada.manzanas.map((m) => [m.idManzana, m.ump, m.formularios])).toEqual([["M1", "96", 2], ["M2", "131", 1]]);
    expect(resumirJornada(jornada)).toMatchObject({ formularios: 3, manzanas: 2, fuera: 2, desde: "08:00", hasta: "10:00" });
  });

  it("separa las jornadas por día, la más reciente primero, y el GPS efectivo manda sobre el crudo", () => {
    const modelo = construirRecorrido(corte([
      fila({ response_id: "a", submission_date_iso: "2026-06-13", submission_time: "2026-06-13T09:00:00", distance_m: 500, gps_effective_distance_m: 30 }),
      fila({ response_id: "b" }),
    ]));
    expect(modelo.aplicadores[0].jornadas.map((j) => j.fechaIso)).toEqual(["2026-06-14", "2026-06-13"]);
    expect(modelo.aplicadores[0].jornadas[1].formularios[0].tramo).toBe("cerca");
  });

  it("sin GPS no inventa distancia ni punto", () => {
    const modelo = construirRecorrido(corte([fila({ lat: null, lon: null, gps_effective_lat: null, gps_effective_lon: null })]));
    const formulario = modelo.aplicadores[0].jornadas[0].formularios[0];
    expect([formulario.lat, formulario.tramo]).toEqual([null, "sin-gps"]);
  });

  it("los tramos usan los cortes de la observación GPS: 150 y 300 m", () => {
    expect([150, 151, 300, 301].map((m) => tramoDeDistancia(m, true))).toEqual(["cerca", "revision", "revision", "lejos"]);
  });

  it("sin respuestas en el corte no hay recorrido", () => {
    expect(construirRecorrido(corte([])).disponible).toBe(false);
  });
});

describe("orden de la jornada", () => {
  it("ordena por la hora normalizada aunque submission_time venga en otro formato", () => {
    const modelo = construirRecorrido(corte([
      fila({ response_id: "tarde", submission_time: "22/06/2026 11:44", submission_hour: "11:44" }),
      fila({ response_id: "temprano", submission_time: "2026-06-14T07:49:00-05:00", submission_hour: "7:49" }),
    ]));
    const jornada = modelo.aplicadores[0].jornadas[0];
    expect(jornada.formularios.map((f) => [f.id, f.hora])).toEqual([["temprano", "07:49"], ["tarde", "11:44"]]);
    expect(resumirJornada(jornada)).toMatchObject({ desde: "07:49", hasta: "11:44" });
  });
});
