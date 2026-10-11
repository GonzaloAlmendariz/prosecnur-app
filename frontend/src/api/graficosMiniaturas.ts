// graficosMiniaturas.ts — vista previa asíncrona de una lámina y miniaturas en lote (F6 §5.3, riesgo 7).
// Contrato congelado: docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md (backend `router_graficos_miniaturas.R`).
//
//   POST /api/graficos/preview-slide-job     → job `graficos.preview_slide`; `result_data` = respuesta de /preview-slide
//   POST /api/graficos/miniaturas            → job `graficos.miniaturas` con N láminas
//   GET  /api/graficos/miniaturas/<lote_id>  → estado del lote lámina por lámina, también a medias
//
// Los payloads cruzan el serializador unboxed de R (NULL → {}, vectores de largo 1 → escalares), así que cada respuesta
// pasa por un normalizador defensivo antes de llegar a la UI (patrón `normalizeGraficosShareInspect`).

import { apiFetch, apiPath, getSession, handle, headers } from "./core";
import { normalizeMotivoSinImagen, type MotivoSinImagen, type PreviewSlideOptions, type Slide } from "./graficos";

// ---------- Tipos ----------

export type PreviewSlideJobStart = {
  ok: true;
  job_id: string;
  lote_id: string;
  kind: string;
  total: number;
  en_cache: number;
  pendientes: number;
  hash: string | null;
  slide_id: string | null;
};

export type MiniaturasLoteStart = {
  ok: true;
  job_id: string;
  lote_id: string;
  kind: string;
  total: number;
  en_cache: number;
  pendientes: number;
};

export type MiniaturaEstado = "pendiente" | "ok" | "sin_imagen" | "sin_datos" | "error";
export type MiniaturasLoteStatus = "running" | "done" | "error" | "cancelled";

export type MiniaturaImagen = {
  file_id: string;
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
  sha256: string | null;
};

/** Cuántos gráficos pidió la lámina y cuántos quedaron vacíos (aditivo; puede no venir). `motivo` es texto libre del
 *  backend (borrador incompleto, variable fuera de la base, n = 0…): se muestra, no se interpreta. */
export type MiniaturaGraficos = { pedidos: number; vacios: number; motivo: string | null };

export type MiniaturaLamina = {
  slide_id: string;
  orden: number;
  hash: string | null;
  estado: MiniaturaEstado;
  folio: number | null;
  miniatura: MiniaturaImagen | null;
  /** La lámina dibujada en tamaño completo (aditivo; null si no vino o no hay imagen). */
  imagen: MiniaturaImagen | null;
  avisos: string[];
  error: { code: string; message: string } | null;
  graficos: MiniaturaGraficos | null;
  /** Sólo en `sin_imagen`: por qué no hay miniatura (timeout de LibreOffice ≠ equipo sin LibreOffice). */
  motivo_sin_imagen: MotivoSinImagen | null;
};

export type MiniaturasLote = {
  ok: true;
  lote_id: string;
  job_id: string;
  status: MiniaturasLoteStatus;
  total: number;
  conteo: Record<MiniaturaEstado, number>;
  laminas: MiniaturaLamina[];
};

export type MiniaturasPedido = {
  /** Estado vivo del editor; si falta, el backend toma el plan guardado (o `slide_ids` de él). */
  slides?: Slide[];
  slide_ids?: string[];
  scope?: "consolidated";
  config?: unknown;
  profile_id?: string;
  template_id?: string;
  preview_quality?: "quick" | "normal";
  /** Cancela el lote anterior de la sesión que siga corriendo (default del backend: true). */
  reemplazar?: boolean;
};

// ---------- Normalizadores ----------

type Crudo = Record<string, unknown>;

const objeto = (v: unknown): Crudo => (v && typeof v === "object" && !Array.isArray(v) ? (v as Crudo) : {});
const texto = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const textoONulo = (v: unknown): string | null => texto(v) || null;
const entero = (v: unknown, defecto = 0): number => {
  const n = Number(v);
  return typeof v !== "boolean" && v !== null && v !== "" && Number.isFinite(n) ? Math.trunc(n) : defecto;
};
const enteroONulo = (v: unknown): number | null => {
  const n = entero(v, Number.NaN);
  return Number.isNaN(n) ? null : n;
};
/** Arreglo de R: un vector de largo 1 llega como escalar y uno vacío como {}. */
const arreglo = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === null || v === undefined || (typeof v === "object" && Object.keys(v as object).length === 0) ? [] : [v]);

const ESTADOS: readonly MiniaturaEstado[] = ["pendiente", "ok", "sin_imagen", "sin_datos", "error"];
const STATUS: readonly MiniaturasLoteStatus[] = ["running", "done", "error", "cancelled"];

function normalizarImagen(v: unknown): MiniaturaImagen | null {
  const m = objeto(v);
  const fileId = texto(m.file_id);
  const url = texto(m.url) || (fileId ? `/api/files/${encodeURIComponent(fileId)}/download` : "");
  if (!url) return null;
  return {
    file_id: fileId,
    url,
    mime: texto(m.mime) || "image/png",
    width: enteroONulo(m.width),
    height: enteroONulo(m.height),
    sha256: textoONulo(m.sha256),
  };
}

function normalizarGraficos(v: unknown): MiniaturaGraficos | null {
  const g = objeto(v);
  if (!("pedidos" in g) && !("vacios" in g)) return null;
  const pedidos = Math.max(0, entero(g.pedidos));
  const vacios = Math.min(pedidos, Math.max(0, entero(g.vacios)));
  return { pedidos, vacios, motivo: textoONulo(g.motivo) };
}

function normalizarLamina(v: unknown, k: number): MiniaturaLamina | null {
  const l = objeto(v);
  const slideId = texto(l.slide_id);
  if (!slideId) return null;
  const crudo = texto(l.estado) as MiniaturaEstado;
  const miniatura = normalizarImagen(l.miniatura);
  // Un estado desconocido no se inventa como «ok»: se trata como pendiente (el poll siguiente lo corrige) salvo que
  // ya traiga imagen.
  const estado: MiniaturaEstado = ESTADOS.includes(crudo) ? crudo : miniatura ? "ok" : "pendiente";
  const e = objeto(l.error);
  const error = estado === "error"
    ? { code: texto(e.code) || "E_MINIATURA_FALLIDA", message: texto(e.message) }
    : null;
  const final: MiniaturaEstado = estado === "ok" && !miniatura ? "sin_imagen" : estado;
  return {
    slide_id: slideId,
    orden: entero(l.orden, k + 1),
    hash: textoONulo(l.hash),
    // Sin imagen no hay «ok»: degradar a sin_imagen para que la tira dibuje la composición.
    estado: final,
    folio: enteroONulo(l.folio),
    miniatura,
    imagen: final === "sin_imagen" ? null : normalizarImagen(l.imagen),
    avisos: arreglo(l.avisos).map(texto).filter(Boolean),
    error,
    graficos: normalizarGraficos(l.graficos),
    motivo_sin_imagen: final === "sin_imagen" ? normalizeMotivoSinImagen(l.motivo_sin_imagen) : null,
  };
}

export function normalizeMiniaturasLote(raw: unknown): MiniaturasLote {
  const r = objeto(raw);
  const laminas = arreglo(r.laminas).flatMap((v, k) => {
    const l = normalizarLamina(v, k);
    return l ? [l] : [];
  });
  const c = objeto(r.conteo);
  const conteo = Object.fromEntries(ESTADOS.map((e) => [e, entero(c[e], laminas.filter((l) => l.estado === e).length)])) as Record<MiniaturaEstado, number>;
  const status = texto(r.status) as MiniaturasLoteStatus;
  return {
    ok: true,
    lote_id: texto(r.lote_id),
    job_id: texto(r.job_id),
    status: STATUS.includes(status) ? status : "running",
    total: entero(r.total, laminas.length),
    conteo,
    laminas,
  };
}

function normalizarArranque(raw: unknown) {
  const r = objeto(raw);
  const jobId = texto(r.job_id);
  if (!jobId) throw new Error("El backend no devolvió el trabajo de la vista previa. Reintenta.");
  return {
    ok: true as const,
    job_id: jobId,
    lote_id: texto(r.lote_id),
    kind: texto(r.kind),
    total: entero(r.total),
    en_cache: entero(r.en_cache),
    pendientes: entero(r.pendientes),
  };
}

export function normalizePreviewSlideJobStart(raw: unknown): PreviewSlideJobStart {
  const r = objeto(raw);
  return { ...normalizarArranque(raw), hash: textoONulo(r.hash), slide_id: textoONulo(r.slide_id) };
}

export function normalizeMiniaturasLoteStart(raw: unknown): MiniaturasLoteStart {
  return normalizarArranque(raw);
}

// ---------- Llamadas ----------

/** Misma entrada que `apiGraficosPreviewSlide`; devuelve el job a pollear por `/api/jobs/<id>`. */
export async function apiGraficosPreviewSlideJob(
  slide: Slide,
  config?: unknown,
  options?: PreviewSlideOptions,
  request?: { signal?: AbortSignal },
): Promise<PreviewSlideJobStart> {
  const raw = await handle<unknown>(
    await apiFetch("/api/graficos/preview-slide-job", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ slide, config, ...options }),
      signal: request?.signal,
    }),
  );
  return normalizePreviewSlideJobStart(raw);
}

export async function apiGraficosMiniaturas(pedido: MiniaturasPedido, request?: { signal?: AbortSignal }): Promise<MiniaturasLoteStart> {
  const raw = await handle<unknown>(
    await apiFetch("/api/graficos/miniaturas", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(pedido),
      signal: request?.signal,
    }),
  );
  return normalizeMiniaturasLoteStart(raw);
}

export async function apiGraficosMiniaturasLote(loteId: string, request?: { signal?: AbortSignal }): Promise<MiniaturasLote> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/graficos/miniaturas/${encodeURIComponent(loteId)}`, { headers: headers(), signal: request?.signal }),
  );
  return normalizeMiniaturasLote(raw);
}

/** `src` de la miniatura: un `<img>` no manda el header de sesión, así que el sid viaja en la query (como `downloadUrl`). */
export function miniaturaSrc(m: Pick<MiniaturaImagen, "url">, sid: string | null = getSession()): string {
  if (!sid || /[?&]sid=/.test(m.url)) return apiPath(m.url);
  return apiPath(`${m.url}${m.url.includes("?") ? "&" : "?"}sid=${encodeURIComponent(sid)}`);
}
