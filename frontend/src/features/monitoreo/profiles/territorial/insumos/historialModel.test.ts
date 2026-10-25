import { describe, expect, it } from "vitest";
import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { fechaYHoraDeLima } from "../rotulos";
import { construirHistorial } from "./historialModel";

const STATE = {
  territorial_update_history: [
    { id: "h2", type: "sync", asset_uid: "a", asset_name: "ACNUR Campo", version_id: "v", source_id: "kobo-campo", response_count: 260, status: "ok", message: "", created_at: "2026-06-13T20:00:00Z" },
    { id: "h1", type: "sync", asset_uid: "a", asset_name: "ACNUR Campo", version_id: "v", source_id: "kobo-campo", response_count: 216, status: "ok", message: "", created_at: "2026-06-13T15:00:00Z" },
    { id: "h3", type: "inspect", asset_uid: "a", asset_name: "ACNUR Campo", version_id: "v", source_id: "kobo-campo", response_count: 0, status: "ok", message: "", created_at: "2026-06-18T20:53:00Z" },
    { id: "h4", type: "sync", asset_uid: "p", asset_name: "ACNUR Piloto", version_id: "v", source_id: "kobo-piloto", response_count: 35, status: "error", message: "Kobo no respondió", created_at: "2026-06-19T10:00:00Z" },
  ],
} as unknown as MonitoreoState;

const REPORTS = {
  operational_adjustments: {
    applied: [
      { id: "x1", status: "active", created_at: "2026-07-03T20:22:10" },
      { id: "x2", status: "active", created_at: "2026-07-03T20:22:40" },
      { id: "x3", status: "reverted", created_at: "2026-07-01T10:00:00", reverted_at: "2026-07-03T20:21:00" },
    ],
  },
  production_annulments: { entries: [{ id: "a1", status: "active", scope: "all_production", responsible_label: "P702 · Aplicador", created_at: "2026-06-26T16:51:00" }] },
} as unknown as MonitoreoTerritorialDashboard;

describe("Insumos › Historial", () => {
  const modelo = construirHistorial(STATE, REPORTS, "kobo-campo");

  it("la hora va en Lima, sin depender del ICU", () => {
    expect(fechaYHoraDeLima("2026-06-13T20:00:00Z")).toBe("13/06 15:00");
    expect(fechaYHoraDeLima("2026-07-03T20:22:00")).toBe("03/07 20:22");
    expect(fechaYHoraDeLima("")).toBe("");
  });

  it("cada lectura con lo que trajo y lo nuevo respecto de la anterior de la misma fuente, lo último primero", () => {
    expect(modelo.lecturas.map((item) => [item.accion, item.fuente, item.respuestas, item.nuevas, item.tono])).toEqual([
      ["Traer", "ACNUR Piloto", 35, null, "error"],
      ["Releer ficha", "ACNUR Campo", 0, null, "ok"],
      ["Traer", "ACNUR Campo", 260, 44, "ok"],
      ["Traer", "ACNUR Campo", 216, null, "ok"],
    ]);
    expect(modelo.lecturas[0].resultado).toBe("Falló: Kobo no respondió");
  });

  it("la serie es la de la fuente activa, en orden", () => {
    expect(modelo.serie).toEqual([{ cuando: "13/06 10:00", respuestas: 216 }, { cuando: "13/06 15:00", respuestas: 260 }]);
  });

  it("las otras acciones agrupan las subsanaciones del mismo minuto y suman las anulaciones", () => {
    expect(modelo.otras.map((item) => [item.cuando, item.texto])).toEqual([
      ["03/07 20:22", "2 subsanaciones aplicadas"],
      ["03/07 20:21", "1 subsanación revertida"],
      ["26/06 16:51", "Anulación de la producción de P702 · Aplicador"],
    ]);
  });
});
