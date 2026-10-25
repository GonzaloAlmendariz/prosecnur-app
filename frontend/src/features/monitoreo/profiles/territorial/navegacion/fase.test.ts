import { describe, expect, it } from "vitest";
import type { MonitoreoState } from "../../../../../api/client";
import { opcionesDeFase } from "./fase";

function estado(): MonitoreoState {
  return {
    config: { territorial: { phase_windows: { field: { start_at: "2026-06-12" } } } },
    territorial_phase_coherence: {
      phases: {
        pilot: { phase: "pilot", status: "ok", local_rows: 35, last_sync_at: "2026-06-25T10:00:00" },
        field: { phase: "field", status: "ok", dashboard_rows: 1594, last_sync_at: "2026-06-26T09:53:00" },
      },
    },
  } as unknown as MonitoreoState;
}

describe("opcionesDeFase: cifras de la tarjeta de fase", () => {
  it("la fase activa trae corte, meta y desde en celdas, sin frase encadenada", () => {
    const campo = opcionesDeFase(estado(), "field", 1200).find((opcion) => opcion.fase === "field");
    expect(campo?.cifras).toEqual([
      { clave: "corte", rotulo: "Respuestas", valor: "1,594", ayuda: "Respuestas de la fase en el corte" },
      { clave: "meta", rotulo: "Meta", valor: "1,200" },
      { clave: "desde", rotulo: "Desde", valor: "12/06" },
    ]);
    for (const cifra of campo?.cifras ?? []) expect(cifra.valor).not.toMatch(/[;:·(,]\s/);
  });

  it("la otra fase cuenta sus respuestas y el selector conserva su frase", () => {
    const piloto = opcionesDeFase(estado(), "field", 1200).find((opcion) => opcion.fase === "pilot");
    expect(piloto?.cifras).toEqual([{ clave: "respuestas", rotulo: "Respuestas", valor: "35" }]);
    expect(piloto?.detalle).toBe("35 respuestas");
  });

  it("sin respuestas no inventa celdas: la frase dice por qué", () => {
    const vacio = opcionesDeFase({} as MonitoreoState, "field", null);
    expect(vacio.every((opcion) => opcion.cifras.length === 0)).toBe(true);
    expect(vacio[0].detalle).toBe("Sin formulario conectado");
  });
});
