import { describe, expect, it } from "vitest";
import { normalizeGraficosConfig } from "../../api/graficosConfigNormalizer";
import { buildGraficosConfigFromStore } from "./configSnapshot";
import { usePlanStore } from "./store";

// La migración del backend (aeb39cc0f) marca `payload.meta.base_por_grafico = TRUE` en las láminas migradas. El
// autosave reconstruye la config desde el store: si `meta` se perdiera ahí, la marca se borraría en el primer guardado.
const lamina = {
  id: "s-1",
  tipo: "p_slide_4_graficos_poblacion",
  payload: { titulo: "Perfil", meta: { base_por_grafico: true, antetitulo: "PERFIL" } },
};

describe("payload.meta de una lámina migrada sobrevive al autosave", () => {
  it("el normalizador de la config la conserva", () => {
    const cfg = normalizeGraficosConfig({ version: "graficos/4", plan: { slides: [lamina] } }) as { plan: { slides: Array<{ payload: Record<string, unknown> }> } };
    expect(cfg.plan.slides[0].payload.meta).toEqual({ base_por_grafico: true, antetitulo: "PERFIL" });
  });

  it("el snapshot que guarda el autosave la conserva tras hidratar y editar otra clave", () => {
    usePlanStore.getState().hydrate({ version: "graficos/4", plan: { slides: [lamina] }, presets: {}, paletas: {}, iconos: [] } as never);
    usePlanStore.getState().updateSlidePayload("s-1", { titulo: "Perfil 2" });
    const cfg = buildGraficosConfigFromStore() as unknown as { plan: { slides: Array<{ payload: Record<string, unknown> }> } };
    expect(cfg.plan.slides[0].payload.meta).toEqual({ base_por_grafico: true, antetitulo: "PERFIL" });
    expect(cfg.plan.slides[0].payload.titulo).toBe("Perfil 2");
  });
});
