import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_WORD_PRESETS,
  createDefaultWordPresets,
  normalizeGraficosConfig,
  normalizeWordPresets,
  wordPresetsDecisiones,
} from "../../api/graficosConfigNormalizer";
import {
  normalizeGraficosConfigDefaults,
  resolveWordPresetsDefaults,
  wordChartPresetsDecisiones,
} from "../../api/graficosConfigDefaults";
import { buildGraficosConfigFromStore } from "./configSnapshot";
import { usePlanStore, type GraficosConfig } from "./store";
import { mergeWithDefaults } from "./useGraficosAutosave";

// Contrato A6 §3 (vitest 1–8), ADR 0094. `documento_word` cruzaba cuatro productores de config y el store no lo
// modelaba: caía en `_unknown`, el hydrate lo descartaba y sólo lo salvaba el backend (bug K3).

const featureDir = path.dirname(fileURLToPath(import.meta.url));

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

const DOCUMENTO = { portada: "C", meta_portada: { para: "Facultad de Ciencias Contables" } } as const;

describe("(1) normalizeGraficosConfig · documento_word es campo de primera clase", () => {
  it("no cae en _unknown y conserva lo válido", () => {
    const out = normalizeGraficosConfig({ documento_word: DOCUMENTO });
    expect(out.documento_word).toEqual(DOCUMENTO);
    expect(out._unknown).toBeUndefined();
  });

  it("acepta el alias camelCase", () => {
    expect(normalizeGraficosConfig({ documentoWord: { apertura: "A" } }).documento_word).toEqual({ apertura: "A" });
  });

  it("descarta lo inválido en vez de mandarlo al 400 del backend, y como_leer «auto» es ausente", () => {
    const out = normalizeGraficosConfig({
      documento_word: {
        portada: "D", apertura: "A", como_leer: "auto", fuente: "  Encuesta 2026 ", contacto: { correo: "", web: 3 },
        desconocida: 1,
      },
    });
    expect(out.documento_word).toEqual({ apertura: "A", fuente: "Encuesta 2026" });
  });

  it("siempre viaja, aunque sea vacío: ausente o `[]` de R → {}", () => {
    expect(normalizeGraficosConfig({}).documento_word).toEqual({});
    expect(normalizeGraficosConfig({ documento_word: [] }).documento_word).toEqual({});
  });
});

describe("(2) hydrate → productor único conserva documento_word (bug K3)", () => {
  beforeEach(() => usePlanStore.getState().hydrate(emptyConfig()));

  it("lo que llega del backend sale igual en la próxima config", () => {
    usePlanStore.getState().hydrate(emptyConfig({ documento_word: DOCUMENTO }));
    expect(usePlanStore.getState().documentoWord).toEqual(DOCUMENTO);
    expect(buildGraficosConfigFromStore().documento_word).toEqual(DOCUMENTO);
  });

  it("el setter marca sucio y la config lo lleva", () => {
    usePlanStore.getState().setDocumentoWord({ portada: "B" });
    expect(usePlanStore.getState().dirty).toBe(true);
    expect(buildGraficosConfigFromStore().documento_word).toEqual({ portada: "B" });
  });
});

describe("(3) el autosave arma la config con el productor único", () => {
  const source = fs.readFileSync(path.join(featureDir, "useGraficosAutosave.ts"), "utf8");

  it("el debounce llama a buildGraficosConfigFromStore y no tiene literal propio", () => {
    const debounce = source.slice(source.indexOf("// 2) Autosave debounced."), source.indexOf("const seedConsolidatedPlan"));
    expect(debounce).toContain("const config = buildGraficosConfigFromStore();");
    expect(debounce).not.toMatch(/w_presets\s*:/);
    expect(debounce).not.toMatch(/version:\s*"graficos\/4"/);
  });

  it("la semilla del consolidado tampoco tiene literal propio", () => {
    const seed = source.slice(source.indexOf("const seedConsolidatedPlan"), source.indexOf("return { saveConsolidatedNow"));
    expect(seed).toContain("buildGraficosConfig(");
    expect(seed).not.toMatch(/w_presets\s*:/);
  });

  it("la semilla conserva documento_word y el sello de equivalencias", () => {
    // Misma llamada que hace `seedConsolidatedPlan`, sin montar el hook.
    usePlanStore.getState().hydrate(emptyConfig({ documento_word: { portada: "C" }, equivalencias_revision: "rev-1" }));
    const cfg = buildGraficosConfigFromStore();
    usePlanStore.getState().hydrate({ ...cfg, plan: { slides: [] } });
    expect(usePlanStore.getState().documentoWord).toEqual({ portada: "C" });
    expect(usePlanStore.getState().equivalenciasRevision).toBe("rev-1");
  });
});

describe("(4) reset", () => {
  it("tras reset viaja documento_word: {} con la clave presente", () => {
    usePlanStore.getState().hydrate(emptyConfig({ documento_word: DOCUMENTO }));
    usePlanStore.getState().reset();
    const cfg = buildGraficosConfigFromStore();
    expect(Object.prototype.hasOwnProperty.call(cfg, "documento_word")).toBe(true);
    expect(cfg.documento_word).toEqual({});
    // Lo que de verdad ve el backend: una clave ausente le haría conservar lo guardado.
    expect(JSON.stringify(cfg)).toContain('"documento_word":{}');
  });
});

describe("(5) mergeWithDefaults", () => {
  it("incluye documento_word y el sello de equivalencias (antes los descartaba)", () => {
    const merged = mergeWithDefaults({ documento_word: DOCUMENTO, equivalencias_revision: "rev-9" });
    expect(merged.documento_word).toEqual(DOCUMENTO);
    expect(merged.equivalencias_revision).toBe("rev-9");
  });

  it("sin config remota devuelve defaults con documento_word vacío y el Word completo", () => {
    const merged = mergeWithDefaults(null);
    expect(merged.documento_word).toEqual({});
    expect(merged.w_presets).toEqual(createDefaultWordPresets());
    expect(merged.plan).toEqual({ slides: [] });
  });

  it("conserva _unknown", () => {
    expect(mergeWithDefaults({ profile_id: "unsa" })._unknown).toEqual({ profile_id: "unsa" });
  });
});

describe("(6) deshacer / rehacer", () => {
  it("restauran documento_word", () => {
    usePlanStore.getState().hydrate(emptyConfig({ documento_word: { portada: "A" } }));
    usePlanStore.getState().setDocumentoWord({ portada: "C" });
    usePlanStore.getState().undo();
    expect(usePlanStore.getState().documentoWord).toEqual({ portada: "A" });
    usePlanStore.getState().redo();
    expect(usePlanStore.getState().documentoWord).toEqual({ portada: "C" });
  });

  it("deshacer un reset devuelve lo que había", () => {
    usePlanStore.getState().hydrate(emptyConfig({ documento_word: DOCUMENTO }));
    usePlanStore.getState().reset();
    usePlanStore.getState().undo();
    expect(usePlanStore.getState().documentoWord).toEqual(DOCUMENTO);
  });
});

describe("(7) «Modificado» compara contra el default (decisión 5a)", () => {
  it("el Word completo igual al default no tiene decisiones", () => {
    expect(wordPresetsDecisiones(createDefaultWordPresets(), DEFAULT_WORD_PRESETS)).toEqual({});
    expect(wordChartPresetsDecisiones(createDefaultWordPresets(), DEFAULT_WORD_PRESETS)).toEqual({});
  });

  it("una clave distinta sí, y sólo esa", () => {
    const actual = createDefaultWordPresets();
    (actual.chart_presets.barras_apiladas as Record<string, unknown>).size_leyenda = 9;
    expect(wordChartPresetsDecisiones(actual, DEFAULT_WORD_PRESETS)).toEqual({ barras_apiladas: { size_leyenda: 9 } });
  });

  it("un tipo sin default declarado cuenta como decisión", () => {
    const actual = { ...createDefaultWordPresets(), chart_presets: { ...createDefaultWordPresets().chart_presets, pie: { size_ejes: 8 } } };
    expect(wordChartPresetsDecisiones(actual, DEFAULT_WORD_PRESETS)).toEqual({ pie: { size_ejes: 8 } });
  });

  it("prefiere los defaults del GET sobre el espejo local", () => {
    const backend = createDefaultWordPresets();
    (backend.chart_presets.barras_apiladas as Record<string, unknown>).size_leyenda = 9;
    const defaults = normalizeGraficosConfigDefaults({ config: {}, defaults: { w_presets: backend } });
    const referencia = resolveWordPresetsDefaults(defaults);
    expect(referencia).toEqual(backend);
    // Con la leyenda en 9 tanto en el estado como en el backend, no hay decisión; contra el espejo (8) la habría.
    expect(wordChartPresetsDecisiones(backend, referencia)).toEqual({});
    expect(wordChartPresetsDecisiones(backend, resolveWordPresetsDefaults(null)))
      .toEqual({ barras_apiladas: { size_leyenda: 9 } });
  });

  it("defaults ausentes o malformados → null y cae al espejo", () => {
    expect(normalizeGraficosConfigDefaults({ config: {} })).toBeNull();
    expect(normalizeGraficosConfigDefaults({ defaults: "x" })).toBeNull();
    expect(normalizeGraficosConfigDefaults({ defaults: { w_presets: [1, 2] } })).toBeNull();
    expect(resolveWordPresetsDefaults(null)).toEqual(DEFAULT_WORD_PRESETS);
  });

  it("el editor cuenta decisiones y no valores no vacíos", () => {
    const editor = fs.readFileSync(path.join(featureDir, "WordPresetsEditor.tsx"), "utf8");
    expect(editor).toContain("wordChartPresetsDecisiones(wPresets, referencia)");
    expect(editor).toContain("resolveWordPresetsDefaults(configDefaults)");
    expect(editor).not.toMatch(/hasValue\(/);
  });

  it("el GET activo publica sus defaults en el store", () => {
    const source = fs.readFileSync(path.join(featureDir, "useGraficosAutosave.ts"), "utf8");
    expect(source).toContain("setConfigDefaults(normalizeGraficosConfigDefaults(r))");
  });
});

describe("(8) un bloque `[]` (lista R vacía) vuelve al default", () => {
  it("w_presets entero, chart_presets o un tipo vacíos no borran el default", () => {
    expect(normalizeWordPresets([])).toEqual(DEFAULT_WORD_PRESETS);
    expect(normalizeWordPresets({ chart_presets: [] })).toEqual(DEFAULT_WORD_PRESETS);
    expect(normalizeWordPresets({ chart_options: [], chart_presets: { barras_apiladas: [] } }))
      .toEqual(DEFAULT_WORD_PRESETS);
  });

  it("y no cuenta como decisión", () => {
    expect(wordPresetsDecisiones({ chart_presets: { barras_apiladas: [] } }, DEFAULT_WORD_PRESETS)).toEqual({});
  });

  it("los defaults del GET toleran `[]` como bloque vacío", () => {
    const defaults = normalizeGraficosConfigDefaults({ defaults: { w_presets: { chart_options: [], chart_presets: {} } } });
    expect(defaults?.w_presets).toEqual({ chart_options: {}, chart_presets: {} });
  });
});
