import { describe, expect, it } from "vitest";
import { normalizeGraficosConfig } from "../../api/graficosConfigNormalizer";
import { buildGraficosConfigFromStore, graficosConfigFromRemote } from "./configSnapshot";
import { usePlanStore } from "./store";

// ADR 0063. `equivalencias_revision` es el sello que decide si aparece el aviso de desfase de la matriz de
// equivalencias (declaracionAplicada.ts / GraficosPage). Si tras recargar el store lo hidrata vacío, el aviso cae a
// «sin-mazo-derivado» en silencio.

describe("equivalencias_revision · ida y vuelta de la config", () => {
  it("normalizeGraficosConfig lo conserva en la raíz y no en _unknown", () => {
    const out = normalizeGraficosConfig({ config: { plan: { slides: [] }, equivalencias_revision: "abc" } });
    expect(out.equivalencias_revision).toBe("abc");
    expect((out._unknown as Record<string, unknown> | undefined)?.equivalencias_revision).toBeUndefined();
  });

  it("graficosConfigFromRemote + hydrate llevan el sello de la raíz al store", () => {
    const cfg = graficosConfigFromRemote({ ok: true, config: { plan: { slides: [] }, equivalencias_revision: "abc" } });
    expect(cfg.equivalencias_revision).toBe("abc");
    usePlanStore.getState().hydrate(cfg);
    expect(usePlanStore.getState().equivalenciasRevision).toBe("abc");
  });

  it("store → payload de autosave → remote conserva el sello", () => {
    usePlanStore.getState().hydrate(graficosConfigFromRemote({ config: { equivalencias_revision: "abc" } }));
    const payload = buildGraficosConfigFromStore();
    expect(payload.equivalencias_revision).toBe("abc");
    expect(graficosConfigFromRemote({ config: payload }).equivalencias_revision).toBe("abc");
  });

  it("forma que hoy devuelve el GET del backend (sello sólo en _unknown): el store igual lo hidrata", () => {
    const remote = {
      ok: true,
      config: { version: "graficos/4", plan: { slides: [] }, _unknown: { equivalencias_revision: "abc" } },
    };
    const cfg = graficosConfigFromRemote(remote);
    usePlanStore.getState().hydrate(cfg);
    expect(usePlanStore.getState().equivalenciasRevision).toBe("abc");
  });
});
