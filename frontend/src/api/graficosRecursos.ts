// Clientes de los recursos del editor remasterizado (F6.0b; dirección F6 §8): biblioteca de íconos del recetario, la
// elección automática con su motivo y el visor del documento Word. Cada respuesta pasa por un normalizador defensivo:
// el backend serializa con auto_unbox y una lista de un elemento puede llegar como escalar.

import { apiFetch, handle, headers } from "./core";
import type { JobStart } from "./jobs";

const comoLista = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : []);
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export type ColorIcono = "navy" | "blanco" | "coral" | "verde";

export type CatalogoIconos = {
  /** Nombres disponibles por color (navy y blanco traen los 124; coral 21; verde 1). */
  colores: Record<ColorIcono, string[]>;
  /** Imágenes pedidas, como data URI. */
  iconos: Record<string, string>;
};

export function normalizarCatalogoIconos(raw: unknown): CatalogoIconos {
  const r = esObjeto(raw) ? raw : {};
  const c = esObjeto(r.colores) ? r.colores : {};
  const iconos: Record<string, string> = {};
  if (esObjeto(r.iconos)) for (const [k, v] of Object.entries(r.iconos)) if (typeof v === "string" && v.startsWith("data:image/")) iconos[k] = v;
  return { colores: { navy: comoLista(c.navy), blanco: comoLista(c.blanco), coral: comoLista(c.coral), verde: comoLista(c.verde) }, iconos };
}

export async function apiGraficosIconosRecetario(color: ColorIcono = "navy", nombres?: string[]): Promise<CatalogoIconos> {
  const q = new URLSearchParams({ color });
  if (nombres?.length) q.set("nombres", nombres.join(","));
  return normalizarCatalogoIconos(await handle<unknown>(await apiFetch(`/api/graficos/iconos-recetario?${q}`, { headers: headers() })));
}

export type ContextoIcono = "capitulo" | "actor" | "ficha";
export type EleccionIcono = { texto: string; icono: string; palabra: string | null; motivo: string };

export function normalizarElecciones(raw: unknown): EleccionIcono[] {
  const r = esObjeto(raw) ? raw : {};
  const lista = Array.isArray(r.elecciones) ? r.elecciones : esObjeto(r.elecciones) ? [r.elecciones] : [];
  return lista.filter(esObjeto).map((e) => ({
    texto: String(e.texto ?? ""),
    icono: String(e.icono ?? ""),
    palabra: typeof e.palabra === "string" && e.palabra ? e.palabra : null,
    motivo: String(e.motivo ?? ""),
  }));
}

/** Qué ícono elige el motor para cada texto (capítulos del índice, actores del objetivo, filas de la ficha) y por qué. */
export async function apiGraficosElegirIconos(contexto: ContextoIcono, textos: string[]): Promise<EleccionIcono[]> {
  return normalizarElecciones(await handle<unknown>(await apiFetch("/api/graficos/iconos-recetario/elegir", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ contexto, textos }),
  })));
}

export type VisorWordCapitulo = { numero: string; titulo: string; desde: number; hasta: number };
export type VisorWordSeccion = { numero: string; titulo: string; pagina: number };
export type VisorWord = {
  fileId: string;
  filename: string;
  exportado: string;
  paginas: string[];
  capitulos: VisorWordCapitulo[];
  secciones: VisorWordSeccion[];
  /** LibreOffice no rellena el índice: el visor lo avisa; Word lo completa al abrir el archivo. */
  indiceVacio: boolean;
};

export function normalizarVisorWord(raw: unknown): VisorWord {
  const r = esObjeto(raw) ? raw : {};
  const m = esObjeto(r.mapa) ? r.mapa : {};
  const objetos = (v: unknown) => (Array.isArray(v) ? v : esObjeto(v) ? [v] : []).filter(esObjeto);
  return {
    fileId: String(r.file_id ?? ""),
    filename: String(r.filename ?? ""),
    exportado: String(r.exportado ?? ""),
    paginas: comoLista(r.paginas).filter((p) => p.startsWith("data:image/")),
    capitulos: objetos(m.capitulos).map((c) => ({ numero: String(c.numero ?? ""), titulo: String(c.titulo ?? ""), desde: Number(c.desde) || 0, hasta: Number(c.hasta) || 0 })),
    secciones: objetos(m.secciones).map((s) => ({ numero: String(s.numero ?? ""), titulo: String(s.titulo ?? ""), pagina: Number(s.pagina) || 0 })),
    indiceVacio: m.indice_vacio === true,
  };
}

/** Lanza el job que convierte el último Word exportado (o `fileId`) en páginas y mapa; el resultado se normaliza con `normalizarVisorWord`. */
export async function apiGraficosWordVisor(fileId?: string): Promise<JobStart> {
  return handle<JobStart>(await apiFetch("/api/graficos/word/visor", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(fileId ? { file_id: fileId } : {}),
  }));
}
