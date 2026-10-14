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
      "compartir/accionesCompartir.ts:apiGraficosConfigImport",
      "compartir/accionesCompartir.ts:apiGraficosShareImport",
      "configSnapshot.ts:apiGraficosConfigPut",
      "useGraficosAutosave.ts:apiGraficosConfigPut",
      "useGraficosAutosave.ts:apiGraficosConsolidadoDraftPut",
    ]);
  });

  it("el flush respeta el alcance hidratado: el compartido nunca va a /graficos/config (A7-1 H1)", () => {
    // Antes este test exigía `scope: "active"` incondicional y fijaba el bug: guardar el proyecto con el borrador
    // compartido hidratado copiaba ese plan sobre la config de la base activa (ADR 0040 §6.1). El comportamiento se
    // prueba con la API mockeada en `configSnapshot.alcance.test.ts`; aquí se fija el orden del flush.
    const source = fs.readFileSync(path.join(featureDir, "configSnapshot.ts"), "utf8");
    const flush = source.slice(source.indexOf("export async function flushGraficosConfigIfHydrated"));
    const consolidado = sourceSection(flush, 'if (alcance?.scope === "consolidated") {', "\n  }\n");

    expectFragmentsInOrder(flush, [
      "const alcance = leerAlcanceHidratado()",
      'if (alcance?.scope === "consolidated") {',
      "await persistir(",
      "markClean()",
      "return true;",
      "const config = buildGraficosConfigFromStore()",
      "persistWithSlideCompositionAck({",
      "sid: getSession()",
      'scope: "active"',
      "config,",
      "persist: () => apiGraficosConfigPut(config)",
      "markClean()",
    ]);
    expect(consolidado).not.toContain("apiGraficosConfigPut");
    expect(consolidado).toContain("alcance.sid !== getSession()");
  });

  it("el autosave registra el alcance en las dos hidrataciones y en la siembra", () => {
    const source = fs.readFileSync(path.join(featureDir, "useGraficosAutosave.ts"), "utf8");
    const hidratar = sourceSection(source, "async function hydrateFromBackend(", "} catch {");
    const [compartido, activa] = hidratar.split("const r = await apiGraficosConfigGet()");
    const siembra = sourceSection(source, "const seedConsolidatedPlan = useCallback(", "return { saveConsolidatedNow");

    expectFragmentsInOrder(compartido ?? "", [
      "apiGraficosConsolidadoDraftGet()",
      "hydrate(config)",
      'registrarAlcanceHidratado({ scope: "consolidated", sid: getSession(), persistirConsolidado: persistConsolidated })',
    ]);
    expectFragmentsInOrder(activa ?? "", [
      "hydrate(config)",
      'registrarAlcanceHidratado({ scope: "active", sid: getSession() })',
    ]);
    expectFragmentsInOrder(siembra, [
      "hydrate(buildGraficosConfig(",
      'registrarAlcanceHidratado({ scope: "consolidated", sid: getSession(), persistirConsolidado: persistConsolidated })',
    ]);
  });

  it("los imports invalidan el sid inicial y sólo reackean el snapshot releído", () => {
    // La lógica de importar salió del header a `compartir/accionesCompartir.ts` (C11/C12, decisión 10): la usan por
    // igual la barra de Láminas y el Editor anterior.
    const source = fs.readFileSync(path.join(featureDir, "compartir", "accionesCompartir.ts"), "utf8");
    const rehidratar = sourceSection(source, "async function rehidratarDesdeBackend(", "// --- C12");
    const packageApply = sourceSection(source, "export async function aplicarPlanPortatil(", "return `Plan aplicado");
    const ioImport = sourceSection(source, "export async function aplicarImportacionJson(", "return rotuloSeccionesImportadas");

    expectFragmentsInOrder(rehidratar, [
      "deps.configGet()",
      "normalizeGraficosConfig(cuerpoConfig(refreshed)",
      "deps.hydrate(cfg as GraficosConfig)",
      'acknowledgeSlideCompositionConfig(sid, "active", cfg)',
    ]);
    expect(rehidratar.match(/acknowledgeSlideCompositionConfig\(/g)).toHaveLength(1);
    expect(rehidratar).not.toContain("getSession");

    expectFragmentsInOrder(packageApply, [
      "const sid = deps.getSession()",
      'invalidateSlideCompositionPersistenceAck(sid, "active")',
      "deps.shareImport(",
      "rehidratarDesdeBackend(sid, deps)",
    ]);
    expect(packageApply.match(/getSession\(\)/g)).toHaveLength(1);

    expectFragmentsInOrder(ioImport, [
      "const sid = deps.getSession()",
      'invalidateSlideCompositionPersistenceAck(sid, "active")',
      "deps.configImport(",
      "rehidratarDesdeBackend(sid, deps)",
    ]);
    expect(ioImport.match(/getSession\(\)/g)).toHaveLength(1);
    expect(ioImport).not.toContain("hydrate(sincronizado");
  });
  it("cablea el conflicto de revisión: el PUT pasa por la guarda, el autosave se detiene y la recarga hidrata (A7 H3)", () => {
    const source = fs.readFileSync(path.join(featureDir, "useGraficosAutosave.ts"), "utf8");
    const persistir = sourceSection(source, "const persistConsolidated = useCallback(", "const saveConsolidatedNow");
    const autosave = sourceSection(source, "// 2) Autosave debounced.", "const seedConsolidatedPlan");
    const recarga = sourceSection(source, "registrarRecargaBorrador(crearRecargaBorrador({", "}));");

    expectFragmentsInOrder(persistir, [
      "guardarBorradorConRevision({",
      "revision: draftRevision.current",
      "guardar: (expectedRevision) =>",
      "apiGraficosConsolidadoDraftPut(config, expectedRevision)",
      "rememberRevision(saved.revision)",
    ]);
    // La revisión no se captura fuera de la guarda: en conflicto el PUT no llega a armarse.
    expect(persistir).not.toMatch(/const expectedRevision\s*=/);
    expect(autosave).toContain("if (!hydrated || !dirty || enConflicto) return;");
    expect(autosave).toMatch(/dirty, hydrated, enConflicto, markClean/);
    expectFragmentsInOrder(recarga, [
      "leer: apiGraficosConsolidadoDraftGet",
      "rememberRevision(r.revision)",
      "hydrate(config)",
      'registrarAlcanceHidratado({ scope: "consolidated", sid: getSession(), persistirConsolidado: persistConsolidated })',
      'acknowledgeSlideCompositionConfig(getSession(), "consolidated", config)',
    ]);
    // Una hidratación correcta desde el backend sale del conflicto (cambio de sesión o de alcance).
    expect(source.match(/hydrate\(config\);\n\s*limpiarConflictoBorrador\(\);/g)).toHaveLength(2);
  });
  // ADR 0101: la siembra del compartido hidrata sólo el plan; el sello `equivalencias_revision` se retiró.
  // Mata: volver a sembrar una revisión de la matriz o fijarla con un setter que marque el borrador como sucio.
  it("la siembra del compartido hidrata el plan sin sello de la matriz", () => {
    const source = fs.readFileSync(path.join(featureDir, "useGraficosAutosave.ts"), "utf8");
    const siembra = sourceSection(source, "const seedConsolidatedPlan = useCallback(", "return { saveConsolidatedNow");
    expectFragmentsInOrder(siembra, ["hydrate(buildGraficosConfig(", "plan: seededPlan"]);
    expect(siembra).not.toMatch(/revision/i);
    const page = fs.readFileSync(path.join(featureDir, "GraficosPage.tsx"), "utf8");
    expect(page).toMatch(/seedConsolidatedPlan\(\s*suggested as GraficosConfig\["plan"\]\s*\)/);
  });

});
