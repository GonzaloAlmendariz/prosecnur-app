import { describe, expect, it } from "vitest";
import type { MonitoreoState } from "../../../../../api/client";
import type { MonitoreoCorte } from "../../../corte/corteContract";
import { conMetaDelProyecto } from "./metaDelCorte";

const corte = { oficial: 360, meta: 300, brecha: 0, avancePct: 120 } as unknown as MonitoreoCorte;

describe("la meta del corte telefónico es la del proyecto", () => {
  it("con objetivo 400 y 360 válidas, la brecha es 40 y el avance 90 %", () => {
    const state = { config: { objetivo_total: 400, goals: [] } } as unknown as MonitoreoState;
    expect(conMetaDelProyecto(corte, state)).toMatchObject({ meta: 400, brecha: 40, avancePct: 90 });
  });

  it("sin meta declarada en el proyecto, se queda la del corte", () => {
    expect(conMetaDelProyecto(corte, { config: { goals: [] } } as unknown as MonitoreoState)).toBe(corte);
  });
});
