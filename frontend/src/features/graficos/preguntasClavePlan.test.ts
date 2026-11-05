import { beforeEach, describe, expect, it } from "vitest";
import { normalizeGraficosConfig } from "../../api/graficosConfigNormalizer";
import { buildGraficosConfigFromStore } from "./configSnapshot";
import { mergeWithDefaults } from "./useGraficosAutosave";
import { usePlanStore, type GraficosConfig } from "./store";

// `plan.preguntas_clave` (H14): las preguntas que el analista marca como clave y de las que el motor propone los hallazgos
// del resumen ejecutivo. Viven en la raíz del plan, como `rotulos_cortos`: editar láminas no puede borrarlas y el snapshot
// que guarda el autosave tiene que llevarlas.
const CLAVES = ["P1", "base$B17"];

function config(): GraficosConfig {
  return {
    version: "graficos/4",
    plan: { slides: [{ id: "a", tipo: "p_slide_1_grafico", payload: { titulo: "T" } }], preguntas_clave: CLAVES },
    presets: {}, w_presets: {}, selected_slide_id: null, paletas: {}, iconos: [], overrides_reusables: [],
    debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
  } as unknown as GraficosConfig;
}

describe("plan.preguntas_clave · ida y vuelta", () => {
  beforeEach(() => { usePlanStore.getState().hydrate(config()); });

  it("el normalizador y mergeWithDefaults lo conservan dentro del plan", () => {
    const n = normalizeGraficosConfig(config() as unknown as Record<string, unknown>);
    expect((n.plan as { preguntas_clave?: unknown }).preguntas_clave).toEqual(CLAVES);
    const m = mergeWithDefaults(config() as unknown as Record<string, unknown>);
    expect((m.plan as { preguntas_clave?: unknown }).preguntas_clave).toEqual(CLAVES);
  });

  it("editar, agregar y mover láminas no lo borra, y el snapshot que se guarda lo lleva", () => {
    const st = usePlanStore.getState();
    st.updateSlidePayload("a", { titulo: "Otro" });
    st.insertSlideAt("p_slide_seccion", { titulo: "S" }, 0);
    st.moveSlideTo("a", 0);
    expect(usePlanStore.getState().plan.preguntas_clave).toEqual(CLAVES);
    const cfg = buildGraficosConfigFromStore() as unknown as { plan: { preguntas_clave?: unknown } };
    expect(cfg.plan.preguntas_clave).toEqual(CLAVES);
  });

  it("setPreguntasClave escribe un paso deshacible y una lista vacía quita la clave", () => {
    const st = usePlanStore.getState();
    st.setPreguntasClave(["P1", " P1 ", "C3", ""]);
    expect(usePlanStore.getState().plan.preguntas_clave).toEqual(["P1", "C3"]);
    expect(usePlanStore.getState().dirty).toBe(true);
    usePlanStore.getState().undo();
    expect(usePlanStore.getState().plan.preguntas_clave).toEqual(CLAVES);
    usePlanStore.getState().setPreguntasClave([]);
    expect("preguntas_clave" in usePlanStore.getState().plan).toBe(false);
    const cfg = buildGraficosConfigFromStore() as unknown as { plan: Record<string, unknown> };
    expect("preguntas_clave" in cfg.plan).toBe(false);
  });
});
