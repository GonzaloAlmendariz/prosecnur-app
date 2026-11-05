import { describe, expect, test, vi } from "vitest";
import { warmupHojasRutaRunData } from "./warmupRegistry";

/**
 * Regresión (2026-11-05): al abrir un proyecto cuyo sorteo se había descartado (confirmar otro territorio
 * lo descarta, y el .pulso guarda la corrida sin `sample`), el warm start lo «restauraba» llamando a
 * sample-preview: aparecía una muestra sorteada a la hora de abrir, sin que nadie pulsara «Sortear».
 * Población, tamaño y cuotas sí se recalculan (la UI lo promete al confirmar); el sorteo es una decisión.
 */
describe("warm start de Hojas de ruta", () => {
  test("rehace población, tamaño y cuotas, pero nunca sortea", async () => {
    const ok = { ok: true } as never;
    const api = {
      apiHojasRutaPopulationPreview: vi.fn(async () => ok),
      apiHojasRutaSampleSizePreview: vi.fn(async () => ok),
      apiHojasRutaQuotaPreview: vi.fn(async () => ok),
      apiHojasRutaSamplePreview: vi.fn(async () => ok),
    };
    const plan = {
      phase: "field",
      config: { territorios: ["150103", "040101"] },
      uiState: { active_stage: "territorio" },
      outputs: {},
    } as unknown as Parameters<typeof warmupHojasRutaRunData>[1];

    const r = await warmupHojasRutaRunData(api as unknown as Parameters<typeof warmupHojasRutaRunData>[0], plan);

    expect(api.apiHojasRutaPopulationPreview).toHaveBeenCalled();
    expect(api.apiHojasRutaQuotaPreview).toHaveBeenCalled();
    expect(api.apiHojasRutaSamplePreview).not.toHaveBeenCalled();
    expect(r).toMatchObject({ sample: false });
  });
});
