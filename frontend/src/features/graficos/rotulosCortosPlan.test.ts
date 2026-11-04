import { beforeEach, describe, expect, it } from "vitest";
import { normalizeGraficosConfig } from "../../api/graficosConfigNormalizer";
import { buildGraficosConfigFromStore } from "./configSnapshot";
import { mergeWithDefaults } from "./useGraficosAutosave";
import { usePlanStore, type GraficosConfig } from "./store";

// `plan.rotulos_cortos` (rótulo completo → corto) lo aplica el job a datos, instrumento y plan (graficos_inclusivo.R).
// Las ediciones del editor rehacían el plan como `{ slides }` y lo borraban la primera vez que se tocaba una lámina: el
// mazo de CCSS volvía a sacar la opción de la beca en cuatro renglones. Estas pruebas fijan el viaje completo.
const LARGO = "Por beca de estudios (puede ser beca 18 o alguna otra beca externa a la universidad a la que se haya accedido)";
const CORTOS = { [LARGO]: "Por beca de estudios (Beca 18 u otra beca externa)" };

function config(): GraficosConfig {
  return {
    version: "graficos/4",
    plan: { slides: [{ id: "a", tipo: "p_slide_1_grafico", payload: { titulo: "T" } }], rotulos_cortos: CORTOS },
    presets: {}, w_presets: {}, selected_slide_id: null, paletas: {}, iconos: [], overrides_reusables: [],
    debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
  } as unknown as GraficosConfig;
}

describe("plan.rotulos_cortos · ida y vuelta", () => {
  beforeEach(() => { usePlanStore.getState().hydrate(config()); });

  it("el normalizador y mergeWithDefaults lo conservan dentro del plan", () => {
    const n = normalizeGraficosConfig(config() as unknown as Record<string, unknown>);
    expect((n.plan as { rotulos_cortos?: unknown }).rotulos_cortos).toEqual(CORTOS);
    const m = mergeWithDefaults(config() as unknown as Record<string, unknown>);
    expect((m.plan as { rotulos_cortos?: unknown }).rotulos_cortos).toEqual(CORTOS);
  });

  it("editar, agregar y mover láminas no lo borra, y el snapshot que se guarda lo lleva", () => {
    const st = usePlanStore.getState();
    st.updateSlidePayload("a", { titulo: "Otro" });
    st.insertSlideAt("p_slide_seccion", { titulo: "S" }, 0);
    st.moveSlideTo("a", 0);
    expect(usePlanStore.getState().plan.rotulos_cortos).toEqual(CORTOS);
    const cfg = buildGraficosConfigFromStore() as unknown as { plan: { rotulos_cortos?: unknown } };
    expect(cfg.plan.rotulos_cortos).toEqual(CORTOS);
  });
});
