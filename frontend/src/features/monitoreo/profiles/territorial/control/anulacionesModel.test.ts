import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { construirAnulaciones, resumenDeTarjeta } from "./anulacionesModel";

const CORTE = {
  route_quota_progress: { ump_groups: [{ ump: "13", status: "complete" }, { ump: "20", status: "pending" }] },
  production_annulments: {
    summary: { annulled_responses: 4, affected_umps: 3 },
    rows: [{ district: "LOS OLIVOS" }, { district: "LOS OLIVOS" }, { district: "ATE" }, { district: "" }],
    entries: [
      { id: "a1", status: "active", scope: "all_production", responsible_label: "P702 · Aplicador", reason: "Caso anulado", created_at: "2026-06-26T16:51:00", impact: { responses_excluded: 311, valid_responses_excluded: 88, umps_affected: 13 } },
      { id: "a2", status: "active", scope: "response", response_label: "dcb2051a-1234-5678", reason: "GPS fuera", created_at: "2026-06-29" },
      { id: "a3", status: "reverted", scope: "all_production", responsible_label: "P446" },
    ],
    // Con los nombres que publica el motor (`.monitoreo_territorial_annulled_blocks_payload`).
    affected_blocks: [
      { block_id: "m13", ump: "UMP 13", manzana: "0100", district: "LOS OLIVOS", responses_annulled: 2, valid_annulled: 1 },
      { block_id: "m20", ump: "20", manzana: "0200", district: "ATE", responses_annulled: 1, valid_annulled: 1 },
      { block_id: "m1301", ump: "1301", manzana: "0900", district: "", responses_annulled: 1, valid_annulled: 0 },
    ],
  },
} as unknown as MonitoreoTerritorialDashboard;

describe("Control › Anulaciones", () => {
  const modelo = construirAnulaciones(CORTE);

  it("cuántos casos quedan fuera, por distrito y con los sin distrito al final", () => {
    expect([modelo.casosFuera, modelo.umpsAfectadas]).toEqual([4, 3]);
    expect(modelo.porDistrito).toEqual([{ distrito: "Los Olivos", casos: 2 }, { distrito: "Ate", casos: 1 }, { distrito: "Sin distrito", casos: 1 }]);
  });

  it("una tarjeta por anulación activa, con su impacto y su motivo", () => {
    expect(modelo.activas.map((item) => [item.titulo, item.alcance, item.cuando])).toEqual([
      ["P702 · Aplicador, producción completa", "produccion", "26/06 16:51"],
      ["Caso dcb2051a-123", "caso", "29/06"],
    ]);
    expect(resumenDeTarjeta(modelo.activas[0])).toBe("311 casos · 88 con consentimiento · 13 UMP");
    expect(resumenDeTarjeta(modelo.activas[1])).toBe("Sin el detalle del impacto");
    expect(modelo.revertidas).toBe(1);
  });

  it("las UMP afectadas dicen su estado actual", () => {
    expect(modelo.umps.map((item) => [item.ump, item.distrito, item.anuladas, item.validasAnuladas, item.estadoActual])).toEqual([
      ["13", "Los Olivos", 2, 1, "Completa"],
      ["20", "Ate", 1, 1, "Con celda pendiente"],
      ["1301", "Sin distrito", 1, 0, "No está en la ruta"],
    ]);
  });

  it("sin anulaciones no inventa nada", () => {
    const vacio = construirAnulaciones(null);
    expect(vacio).toMatchObject({ casosFuera: 0, umpsAfectadas: 0, activas: [], umps: [] });
  });
});
