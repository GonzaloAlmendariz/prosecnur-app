// Acciones de compartir el plan de gráficos (C11 plan portátil y C12 secciones JSON). Sin React: reciben sus
// dependencias (API, sesión, descarga, hidratación) para poder probarse sin red ni DOM. La barra de Láminas y la del
// Editor anterior las usan a través de `useCompartirPlan`.
//
// Importar pasa por la misma validación que el editor siempre usó: `JSON.parse` + `normalizeGraficosConfig` del
// archivo y de la config actual, composición por secciones (`componerImportacion`) y, al aplicar,
// `apiGraficosConfigImport` (que vuelve a normalizar el sobre) seguido de una relectura normalizada. Importar no se
// puede deshacer con Deshacer (la hidratación reinicia el historial), así que se hace en dos pasos: `prepararImportacionJson`
// valida y `aplicarImportacionJson` escribe, y entre ambos la superficie pide confirmación.

import {
  apiGraficosConfigExport,
  apiGraficosConfigGet,
  apiGraficosConfigImport,
  apiGraficosShareExport,
  apiGraficosShareImport,
  apiGraficosShareInspect,
  type GraficosShareInspectResult,
} from "../../../api/graficos";
import { downloadUrl, getSession } from "../../../api/core";
import { normalizeGraficosConfig } from "../../../api/graficosConfigNormalizer";
import { usePlanStore, type GraficosConfig } from "../store";
import { acknowledgeSlideCompositionConfig, invalidateSlideCompositionPersistenceAck } from "../slideCompositionPersistence";
import {
  armarExportacionJson,
  componerImportacion,
  rotuloSeccionesImportadas,
  seccionesElegidas,
  type GraficosJsonSectionId,
  type ModoImportacionJson,
  type SeccionesJson,
} from "./seccionesJson";

export type DepsCompartir = {
  configExport: () => Promise<{ config?: unknown }>;
  configImport: (bundle: unknown) => Promise<unknown>;
  configGet: () => Promise<{ config?: unknown }>;
  shareExport: () => Promise<{ file_id: string; filename: string }>;
  shareInspect: (file: File) => Promise<GraficosShareInspectResult>;
  shareImport: (packageFileId: string, bases: string[]) => Promise<unknown>;
  downloadUrl: (fileId: string) => string;
  getSession: () => string | null;
  hydrate: (cfg: GraficosConfig) => void;
  /** Descarga por enlace: `href` es una URL de la API o un `blob:`. */
  descargar: (href: string, nombre: string) => void;
  crearUrlBlob: (texto: string) => { href: string; liberar: () => void };
  ahora: () => Date;
};

function descargarConEnlace(href: string, nombre: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = nombre;
  a.click();
}

// Las dos escrituras se invocan con paréntesis a propósito: `useGraficosAutosave.test.ts` enumera los call sites que
// mutan la config de Gráficos buscando `nombre(`.
export function depsCompartirPorDefecto(): DepsCompartir {
  return {
    configExport: apiGraficosConfigExport,
    configImport: (bundle) => apiGraficosConfigImport(bundle),
    configGet: apiGraficosConfigGet,
    shareExport: apiGraficosShareExport,
    shareInspect: (file) => apiGraficosShareInspect(file),
    shareImport: (packageFileId, bases) => apiGraficosShareImport(packageFileId, bases),
    downloadUrl,
    getSession,
    hydrate: (cfg) => usePlanStore.getState().hydrate(cfg),
    descargar: descargarConEnlace,
    crearUrlBlob: (texto) => {
      const href = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
      return { href, liberar: () => URL.revokeObjectURL(href) };
    },
    ahora: () => new Date(),
  };
}

function cuerpoConfig(r: { config?: unknown }): unknown {
  return r.config ?? r;
}

/** Relee la config de la base activa tras escribirla e hidrata el editor con ella (lo que el backend guardó). */
async function rehidratarDesdeBackend(sid: string | null, deps: DepsCompartir) {
  const refreshed = await deps.configGet();
  const cfg = normalizeGraficosConfig(cuerpoConfig(refreshed), { includeLegacyAliases: true });
  deps.hydrate(cfg as GraficosConfig);
  acknowledgeSlideCompositionConfig(sid, "active", cfg);
}

// --- C12: secciones JSON ------------------------------------------------------------------------------------------

export async function exportarSeccionesJson(secciones: SeccionesJson, deps: DepsCompartir): Promise<string> {
  const bundle = await deps.configExport();
  const cfg = normalizeGraficosConfig(cuerpoConfig(bundle), { includeLegacyAliases: true });
  const { texto, nombreArchivo } = armarExportacionJson(cfg, secciones, deps.ahora());
  const url = deps.crearUrlBlob(texto);
  try {
    deps.descargar(url.href, nombreArchivo);
  } finally {
    url.liberar();
  }
  return "JSON exportado";
}

export type ImportacionJsonPreparada = {
  nombreArchivo: string;
  /** El archivo ya normalizado: lo que se compone con la config actual al confirmar. */
  entrante: Record<string, unknown>;
  secciones: SeccionesJson;
  seccionIds: GraficosJsonSectionId[];
  modo: ModoImportacionJson;
};

export class ErrorCompartir extends Error {}

/** Lee y valida el archivo sin escribir nada. Un archivo que no es JSON o no tiene forma de config falla aquí. */
export async function prepararImportacionJson(
  file: File,
  secciones: SeccionesJson,
  modo: ModoImportacionJson,
): Promise<ImportacionJsonPreparada> {
  const elegidas = seccionesElegidas(secciones);
  if (elegidas.length === 0) throw new ErrorCompartir("Elige al menos una sección para importar.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch (e) {
    throw new ErrorCompartir(`JSON inválido: ${(e as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ErrorCompartir("JSON inválido: el archivo no contiene un plan de gráficos.");
  }
  return {
    nombreArchivo: file.name,
    entrante: normalizeGraficosConfig(parsed),
    secciones: { ...secciones },
    seccionIds: elegidas.map((s) => s.id),
    modo,
  };
}

/** Escribe la importación ya confirmada: compone con la config actual del backend, la guarda y rehidrata. */
export async function aplicarImportacionJson(prep: ImportacionJsonPreparada, deps: DepsCompartir): Promise<string> {
  const actual = normalizeGraficosConfig(cuerpoConfig(await deps.configExport()));
  const sincronizado = componerImportacion(actual, prep.entrante, prep.secciones, prep.modo);
  const sid = deps.getSession();
  invalidateSlideCompositionPersistenceAck(sid, "active");
  await deps.configImport({ version: "graficos/4", config: sincronizado });
  await rehidratarDesdeBackend(sid, deps);
  return rotuloSeccionesImportadas(prep.seccionIds.length);
}

// --- C11: plan portátil -------------------------------------------------------------------------------------------

export async function exportarPlanPortatil(deps: DepsCompartir): Promise<string> {
  const result = await deps.shareExport();
  deps.descargar(deps.downloadUrl(result.file_id), result.filename || "plan_graficos.pulso-graficos.zip");
  return "Paquete compartible exportado";
}

export function seleccionInicialBases(plan: GraficosShareInspectResult): Record<string, boolean> {
  return Object.fromEntries(plan.bases.map((b) => [b.base_name, Boolean(b.selected_default && !b.blocking)]));
}

export function basesAplicables(plan: GraficosShareInspectResult | null, seleccion: Record<string, boolean>): string[] {
  if (!plan) return [];
  return plan.bases.filter((b) => !b.blocking && seleccion[b.base_name]).map((b) => b.base_name);
}

export async function inspeccionarPlanPortatil(
  file: File,
  deps: DepsCompartir,
): Promise<{ plan: GraficosShareInspectResult; seleccion: Record<string, boolean>; mensaje: string }> {
  const plan = await deps.shareInspect(file);
  return {
    plan,
    seleccion: seleccionInicialBases(plan),
    mensaje: `${plan.summary.n_compatible}/${plan.summary.n_bases} bases compatibles`,
  };
}

export async function aplicarPlanPortatil(
  plan: GraficosShareInspectResult,
  bases: string[],
  deps: DepsCompartir,
): Promise<string> {
  if (!bases.length) throw new ErrorCompartir("Selecciona al menos una base compatible.");
  const sid = deps.getSession();
  invalidateSlideCompositionPersistenceAck(sid, "active");
  await deps.shareImport(plan.package_file_id, bases);
  await rehidratarDesdeBackend(sid, deps);
  return `Plan aplicado a ${bases.length} base${bases.length === 1 ? "" : "s"}`;
}
