import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acknowledgeSlideCompositionConfig,
  acknowledgeSlideCompositionRevision,
  clearSlideCompositionPersistenceAcks,
  getSlideCompositionPersistenceAck,
  hasExactSlideCompositionPersistenceAck,
  persistWithSlideCompositionAck,
  slideCompositionRevision,
  slideCompositionRevisionFromConfig,
} from "./slideCompositionPersistence";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

const DIRECT_GRAFICOS_MUTATIONS = [
  "apiGraficosConfigPut",
  "apiGraficosConsolidadoDraftPut",
  "apiGraficosConfigImport",
  "apiGraficosShareImport",
] as const;

function productTypeScriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return productTypeScriptFiles(absolutePath);
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || /\.(?:test|spec)\./.test(entry.name)) return [];
    return [absolutePath];
  });
}

function directGraficosMutationCalls(): string[] {
  return productTypeScriptFiles(featureDir).flatMap((file) => {
    const source = fs.readFileSync(file, "utf8");
    const relativePath = path.relative(featureDir, file).split(path.sep).join("/");
    return DIRECT_GRAFICOS_MUTATIONS.flatMap((callee) =>
      Array.from(source.matchAll(new RegExp(`\\b${callee}\\s*\\(`, "g")), () => `${relativePath}:${callee}`),
    );
  }).sort();
}

function sourceSection(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex, `No se encontró el inicio: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `No se encontró el fin: ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

function expectFragmentsInOrder(source: string, fragments: string[]) {
  let cursor = -1;
  for (const fragment of fragments) {
    const next = source.indexOf(fragment, cursor + 1);
    expect(next, `No se encontró en orden: ${fragment}`).toBeGreaterThan(cursor);
    cursor = next;
  }
}

function persistedConfig() {
  return {
    presets: { slide: { margin: 0.12 } },
    debug_ph: { activo: false, color: "#ff00ff", lwd: 0.6 },
    scope_rules: {
      global: {
        template_id: "template-explicit",
        presets: { slide: { margin: 0.12 } },
        debug_ph: { activo: false, color: "#ff00ff", lwd: 0.6 },
        paletas: { base: "#123456" },
        overrides_reusables: [],
      },
    },
  };
}

describe("ack de persistencia para composición", () => {
  beforeEach(() => {
    clearSlideCompositionPersistenceAcks();
  });

  it("publica el snapshot exacto de la hidratación GET y normaliza mirrors", () => {
    const config = persistedConfig();
    const expected = slideCompositionRevision({
      presets: config.presets,
      debugPh: config.debug_ph,
      scopeRules: { global: { template_id: "template-explicit" } },
    });

    expect(slideCompositionRevisionFromConfig(config)).toBe(expected);
    expect(getSlideCompositionPersistenceAck("sid-1", "active")).toBeNull();
    expect(acknowledgeSlideCompositionConfig("sid-1", "active", config)).toBe(expected);
    expect(getSlideCompositionPersistenceAck("sid-1", "active")).toBe(expected);
  });

  it("publica el ack del PUT sólo tras éxito y desde el config enviado", async () => {
    const config = persistedConfig();
    const sentRevision = slideCompositionRevisionFromConfig(config);
    let release: () => void = () => {
      throw new Error("PUT de prueba no iniciado");
    };
    const persist = vi.fn(() => new Promise<{ ok: true }>((resolve) => {
      release = () => resolve({ ok: true });
    }));

    const pending = persistWithSlideCompositionAck({
      sid: "sid-1",
      scope: "active",
      config,
      persist,
    });
    config.presets.slide.margin = 0.4;

    expect(getSlideCompositionPersistenceAck("sid-1", "active")).toBeNull();
    release();
    await expect(pending).resolves.toEqual({ ok: true });
    expect(getSlideCompositionPersistenceAck("sid-1", "active")).toBe(sentRevision);
    expect(getSlideCompositionPersistenceAck("sid-1", "active")).not.toBe(
      slideCompositionRevisionFromConfig(config),
    );
  });

  it("un PUT fallido no publica ni reemplaza el ack anterior", async () => {
    acknowledgeSlideCompositionRevision("sid-1", "active", "revision-old");

    await expect(persistWithSlideCompositionAck({
      sid: "sid-1",
      scope: "active",
      config: persistedConfig(),
      persist: async () => { throw new Error("PUT fallido"); },
    })).rejects.toThrow("PUT fallido");
    expect(getSlideCompositionPersistenceAck("sid-1", "active")).toBe("revision-old");
  });

  it("un ack viejo no habilita otra revisión y sid/scope quedan aislados", () => {
    acknowledgeSlideCompositionRevision("sid-a", "active", "revision-a");

    expect(hasExactSlideCompositionPersistenceAck("sid-a", "active", "revision-a")).toBe(true);
    expect(hasExactSlideCompositionPersistenceAck("sid-a", "active", "revision-b")).toBe(false);
    expect(getSlideCompositionPersistenceAck("sid-a", "consolidated")).toBeNull();
    expect(getSlideCompositionPersistenceAck("sid-b", "active")).toBeNull();
  });

  it("cablea GET, PUT activo y guardado consolidado sin reloj fijo", () => {
    const source = fs.readFileSync(path.join(featureDir, "useGraficosAutosave.ts"), "utf8");

    expect(source).toContain("invalidateSlideCompositionPersistenceAck(getSession(), reportScope)");
    expect(source.match(/acknowledgeSlideCompositionConfig\(getSession\(\), reportScope, config\)/g))
      .toHaveLength(2);
    expect(source.match(/persistWithSlideCompositionAck\(/g)).toHaveLength(2);
    expect(source).not.toMatch(/2_500|AUTOSAVE_SETTLE/);
  });

  it("enumera todos los call sites directos que mutan la configuración de Gráficos", () => {
    expect(directGraficosMutationCalls()).toEqual([
      "GraficosHeader.tsx:apiGraficosConfigImport",
      "GraficosHeader.tsx:apiGraficosShareImport",
      "configSnapshot.ts:apiGraficosConfigPut",
      "useGraficosAutosave.ts:apiGraficosConfigPut",
      "useGraficosAutosave.ts:apiGraficosConsolidadoDraftPut",
    ]);
  });

  it("el flush captura un config y sólo marca limpio después del PUT acreditado", () => {
    const source = fs.readFileSync(path.join(featureDir, "configSnapshot.ts"), "utf8");
    const flush = source.slice(source.indexOf("export async function flushGraficosConfigIfHydrated"));

    expectFragmentsInOrder(flush, [
      "const config = buildGraficosConfigFromStore()",
      "persistWithSlideCompositionAck({",
      "sid: getSession()",
      'scope: "active"',
      "config,",
      "persist: () => apiGraficosConfigPut(config)",
      "markClean()",
    ]);
    expect(flush.match(/getSession\(\)/g)).toHaveLength(1);
  });

  it("los imports invalidan el sid inicial y sólo reackean el snapshot releído", () => {
    const source = fs.readFileSync(path.join(featureDir, "GraficosHeader.tsx"), "utf8");
    const packageApply = sourceSection(source, "async function packageApply()", "async function ioExport()");
    const ioImport = sourceSection(source, "async function ioImport(file?: File)", "function onResetClick()");

    expectFragmentsInOrder(packageApply, [
      "const sid = getSession()",
      'invalidateSlideCompositionPersistenceAck(sid, "active")',
      "apiGraficosShareImport(",
      "apiGraficosConfigGet()",
      "normalizeGraficosConfig(refreshed.config ?? refreshed",
      "hydrate(cfg as never)",
      'acknowledgeSlideCompositionConfig(sid, "active", cfg)',
      "} catch",
    ]);
    expect(packageApply.match(/getSession\(\)/g)).toHaveLength(1);
    expect(packageApply.match(/acknowledgeSlideCompositionConfig\(/g)).toHaveLength(1);

    expectFragmentsInOrder(ioImport, [
      "const sid = getSession()",
      'invalidateSlideCompositionPersistenceAck(sid, "active")',
      "apiGraficosConfigImport(",
      "apiGraficosConfigGet()",
      "normalizeGraficosConfig(refreshed.config ?? refreshed",
      "hydrate(cfg as never)",
      'acknowledgeSlideCompositionConfig(sid, "active", cfg)',
      "} catch",
    ]);
    expect(ioImport.match(/getSession\(\)/g)).toHaveLength(1);
    expect(ioImport.match(/acknowledgeSlideCompositionConfig\(/g)).toHaveLength(1);
    expect(ioImport).not.toContain("hydrate(synced as never)");
  });
});
