import { beforeEach, describe, expect, it } from "vitest";
import { normalizeGraficosConfig } from "../../api/graficosConfigNormalizer";
import { buildGraficosConfigFromStore } from "./configSnapshot";
import { mergeWithDefaults } from "./useGraficosAutosave";
import { usePlanStore, type GraficosConfig } from "./store";

// El interruptor de láminas de «Otros» cruza CUATRO whitelists campo a campo
// —el normalizador, `mergeWithDefaults`, el snapshot del store y el
// normalizador de R— y basta que una lo omita para que el booleano se pierda
// sin error. Eso es exactamente lo que pasó en ACRD Ingeniería: los informes
// entregados tenían las láminas, el plan guardado no, y al regenerar
// desaparecían (31 diapositivas contra 39). Estas pruebas fijan el viaje
// completo de ida y vuelta.

function emptyConfig(patch: Partial<GraficosConfig> = {}): GraficosConfig {
  return {
    version: "graficos/4",
    plan: { slides: [] },
    presets: {},
    w_presets: {},
    selected_slide_id: null,
    paletas: {},
    iconos: [],
    overrides_reusables: [],
    debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
    ...patch,
  } as GraficosConfig;
}

describe("normalizeGraficosConfig · auto_otros_slides", () => {
  it("conserva la bandera encendida en la raíz y no la degrada a _unknown", () => {
    const out = normalizeGraficosConfig({ auto_otros_slides: true });
    expect(out.auto_otros_slides).toBe(true);
    expect((out._unknown as Record<string, unknown> | undefined)?.auto_otros_slides)
      .toBeUndefined();
  });

  it("acepta el alias camelCase que ya entiende el backend", () => {
    expect(normalizeGraficosConfig({ autoOtrosSlides: true }).auto_otros_slides).toBe(true);
  });

  it("queda apagada cuando no viene, y ante un valor que no es booleano", () => {
    expect(normalizeGraficosConfig({}).auto_otros_slides).toBe(false);
    expect(normalizeGraficosConfig({ auto_otros_slides: "si" }).auto_otros_slides).toBe(false);
  });

  it("hereda la bandera puesta a mano sólo dentro de scope_rules.global", () => {
    const out = normalizeGraficosConfig({
      scope_rules: { global: { auto_otros_slides: true } },
    });
    expect(out.auto_otros_slides).toBe(true);
  });

  it("un false explícito en la raíz le gana al global heredado", () => {
    const out = normalizeGraficosConfig({
      auto_otros_slides: false,
      scope_rules: { global: { auto_otros_slides: true } },
    });
    expect(out.auto_otros_slides).toBe(false);
  });
});

// El fallback vive en el normalizador y no en un hidratador concreto: los
// cuatro caminos de hydrate (autosave, import de JSON, aplicar paquete
// compartido, semilla del consolidado) pasan por él, y tenerlo en uno solo
// hacía que los otros apagaran una bandera que nadie tocó.
describe("mergeWithDefaults · auto_otros_slides", () => {
  it("hereda lo que el normalizador ya resolvió desde scope_rules.global", () => {
    const merged = mergeWithDefaults({
      scope_rules: { global: { auto_otros_slides: true } },
    });
    expect(merged.auto_otros_slides).toBe(true);
  });

  it("apagada por defecto cuando el backend no la manda", () => {
    expect(mergeWithDefaults({ plan: { slides: [] } }).auto_otros_slides).toBe(false);
  });
});

describe("store + snapshot · auto_otros_slides", () => {
  beforeEach(() => {
    usePlanStore.getState().hydrate(emptyConfig());
  });

  it("arranca apagada y el hydrate lee lo guardado en el proyecto", () => {
    expect(usePlanStore.getState().autoOtrosSlides).toBe(false);
    usePlanStore.getState().hydrate(emptyConfig({ auto_otros_slides: true }));
    expect(usePlanStore.getState().autoOtrosSlides).toBe(true);
  });

  it("encenderla marca el plan sucio para que el autosave la persista", () => {
    expect(usePlanStore.getState().dirty).toBe(false);
    usePlanStore.getState().setAutoOtrosSlides(true);
    expect(usePlanStore.getState().dirty).toBe(true);
  });

  it("viaja en la raíz Y en scope_rules.global, que es lo que lee el motor", () => {
    usePlanStore.getState().setAutoOtrosSlides(true);
    const cfg = buildGraficosConfigFromStore() as unknown as Record<string, unknown>;
    expect(cfg.auto_otros_slides).toBe(true);
    const global = (cfg.scope_rules as Record<string, Record<string, unknown>>).global;
    expect(global.auto_otros_slides).toBe(true);
  });

  it("apagarla vuelve a escribir false en ambos lugares, no borra la clave", () => {
    usePlanStore.getState().hydrate(emptyConfig({ auto_otros_slides: true }));
    usePlanStore.getState().setAutoOtrosSlides(false);
    const cfg = buildGraficosConfigFromStore() as unknown as Record<string, unknown>;
    expect(cfg.auto_otros_slides).toBe(false);
    const global = (cfg.scope_rules as Record<string, Record<string, unknown>>).global;
    expect(global.auto_otros_slides).toBe(false);
  });
});

// Contrato A5 2b (W1): «Otros» entra al historial, el plan no lo arrastra y aplicar un plan sugerido es UN paso.
describe("A5 2b · «Otros» deshacible y plan sugerido en un paso", () => {
  beforeEach(() => {
    usePlanStore.getState().hydrate(emptyConfig());
  });

  // Mata: quitar `autoOtrosSlides` del Snapshot (undo no lo restauraría).
  it("deshacer el interruptor restaura «Otros» y rehacer lo vuelve a poner", () => {
    usePlanStore.getState().setAutoOtrosSlides(true);
    expect(usePlanStore.getState().past).toHaveLength(1);
    usePlanStore.getState().undo();
    expect(usePlanStore.getState().autoOtrosSlides).toBe(false);
    usePlanStore.getState().redo();
    expect(usePlanStore.getState().autoOtrosSlides).toBe(true);
  });

  // Mata: no quitar `auto_otros_slides` de `plan` (le ganaría al interruptor en router_graficos.R).
  it("un plan.auto_otros_slides sube a la raíz si falta y siempre sale de plan", () => {
    const sube = normalizeGraficosConfig({ plan: { slides: [], auto_otros_slides: true } });
    expect(sube.auto_otros_slides).toBe(true);
    expect((sube.plan as Record<string, unknown>).auto_otros_slides).toBeUndefined();
    const raizManda = normalizeGraficosConfig({ auto_otros_slides: false, plan: { slides: [], auto_otros_slides: true } });
    expect(raizManda.auto_otros_slides).toBe(false);
    expect("auto_otros_slides" in (raizManda.plan as Record<string, unknown>)).toBe(false);
    usePlanStore.getState().hydrate(normalizeGraficosConfig({ plan: { slides: [], auto_otros_slides: true } }) as GraficosConfig);
    expect("auto_otros_slides" in (buildGraficosConfigFromStore().plan as Record<string, unknown>)).toBe(false);
  });

  // Mata: volver a los setters sueltos (loadPlan + setEquivalenciasRevision + applyPptStyleProfile + setScopeRules).
  it("aplicarPlanSugerido es un solo paso con plan, revisión, perfil e identidad, y un deshacer lo revierte entero", () => {
    usePlanStore.getState().aplicarPlanSugerido({
      plan: { slides: [{ id: "s-1", tipo: "p_slide_portada", payload: { titulo: "Informe" } }] },
      revision: "rev-7",
      perfil: { name: "acnur", titulo_humano: "ACNUR", descripcion: "", icono_ui: "", preview_colors: [], presets: { base: { color: "x" } } },
      identidad: { profile_id: "acnur", template_id: "acnur_16_9" },
    });
    const s = usePlanStore.getState();
    expect(s.past).toHaveLength(1);
    expect(s.plan.slides.map((x) => x.id)).toEqual(["s-1"]);
    expect(s.selectedSlideId).toBe("s-1");
    expect(s.equivalenciasRevision).toBe("rev-7");
    expect(s.presets.base).toEqual({ color: "x" });
    expect((s.scopeRules.global as Record<string, unknown>).template_id).toBe("acnur_16_9");
    expect(s.autoOtrosSlides).toBe(false);
    s.undo();
    const d = usePlanStore.getState();
    expect(d.plan.slides).toHaveLength(0);
    expect(d.equivalenciasRevision).toBe("");
    expect(d.presets).toEqual({});
    expect(d.scopeRules.global).toBeUndefined();
  });

  it("sin revisión conserva el sello; con autoOtrosSlides aceptado lo aplica en el mismo paso", () => {
    usePlanStore.getState().hydrate(emptyConfig({ equivalencias_revision: "rev-1" }));
    usePlanStore.getState().aplicarPlanSugerido({ plan: { slides: [] }, perfil: null, identidad: null, autoOtrosSlides: true });
    const s = usePlanStore.getState();
    expect(s.equivalenciasRevision).toBe("rev-1");
    expect(s.autoOtrosSlides).toBe(true);
    expect(s.past).toHaveLength(1);
  });
});
