// Líneas visuales propias, guardadas en la app (ID3 del rediseño, decisión D7). Contrato en el encabezado de
// api/R/graficos_lineas_visuales.R. Una línea propia tiene la forma de un perfil del recetario (`PptStyleProfileMeta`),
// así que se aplica igual (`applyPptStyleProfile`), más `id`, `incluye`, `origen` y fechas. Plumber serializa los
// escalares como `[x]`: el normalizador los desenvuelve y descarta lo que no tiene forma de línea.

import { apiFetch, handle, headers } from "./core";
import type { PptStyleProfileMeta } from "./graficos";

export type IncluyeLinea = { colores: boolean; portada: boolean; letra: boolean; logos: boolean };
export type LineaVisualPropia = PptStyleProfileMeta & {
  id: string;
  incluye: IncluyeLinea;
  origen: "propia";
  creada: string;
  modificada: string;
};
/** Lo que el front manda al guardar: el servidor pone `origen` y fechas, y `id` va en la ruta. */
export type LineaVisualNueva = Pick<LineaVisualPropia, "titulo_humano" | "descripcion" | "preview_colors" | "presets" | "paletas" | "overrides_reusables" | "scope_rules" | "incluye">;

const esRegistro = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** `["x"]` → `"x"`; un escalar queda igual. */
const uno = (v: unknown): unknown => (Array.isArray(v) && v.length === 1 && !esRegistro(v[0]) && !Array.isArray(v[0]) ? v[0] : v);
const texto = (v: unknown) => { const x = uno(v); return typeof x === "string" ? x : ""; };
const booleano = (v: unknown, porDefecto = true) => { const x = uno(v); return typeof x === "boolean" ? x : porDefecto; };
/** Desenvuelve recursivamente los `[x]` de Plumber dentro de presets, paletas y reglas. */
function desenvolver(v: unknown): unknown {
  if (Array.isArray(v)) { const x = uno(v); return x === v ? v.map(desenvolver) : x; }
  if (esRegistro(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, desenvolver(x)]));
  return v;
}

export function normalizarLineaVisual(crudo: unknown): LineaVisualPropia | null {
  if (!esRegistro(crudo)) return null;
  const id = texto(crudo.id);
  if (!/^lv-[a-z0-9][a-z0-9-]{2,59}$/.test(id)) return null;
  const incl = esRegistro(crudo.incluye) ? crudo.incluye : {};
  const colores = Array.isArray(crudo.preview_colors) ? crudo.preview_colors.map(texto).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c)) : [];
  const registro = (v: unknown) => (esRegistro(v) ? (desenvolver(v) as Record<string, never>) : {});
  return {
    id,
    name: id,
    titulo_humano: texto(crudo.titulo_humano) || id,
    descripcion: texto(crudo.descripcion),
    icono_ui: "Palette",
    preview_colors: colores,
    presets: registro(crudo.presets),
    paletas: registro(crudo.paletas),
    overrides_reusables: Array.isArray(crudo.overrides_reusables) ? (desenvolver(crudo.overrides_reusables) as PptStyleProfileMeta["overrides_reusables"]) : [],
    scope_rules: registro(crudo.scope_rules),
    incluye: { colores: booleano(incl.colores), portada: booleano(incl.portada), letra: booleano(incl.letra), logos: booleano(incl.logos) },
    origen: "propia",
    creada: texto(crudo.creada),
    modificada: texto(crudo.modificada),
  };
}

export async function apiGraficosLineasVisuales(): Promise<LineaVisualPropia[]> {
  const r = await handle<{ lineas?: unknown }>(await apiFetch("/api/graficos/lineas-visuales", { headers: headers() }));
  return (Array.isArray(r.lineas) ? r.lineas : []).map(normalizarLineaVisual).filter((l): l is LineaVisualPropia => l !== null);
}

export async function apiGraficosGuardarLineaVisual(id: string, linea: LineaVisualNueva): Promise<LineaVisualPropia> {
  const r = await handle<{ linea?: unknown }>(await apiFetch(`/api/graficos/lineas-visuales/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(linea),
  }));
  const guardada = normalizarLineaVisual(r.linea);
  if (!guardada) throw new Error("La app no devolvió la línea visual guardada.");
  return guardada;
}

export async function apiGraficosEliminarLineaVisual(id: string): Promise<void> {
  await handle<unknown>(await apiFetch(`/api/graficos/lineas-visuales/${encodeURIComponent(id)}`, { method: "DELETE", headers: headers() }));
}

/** Id nuevo para una línea propia: `lv-` + el nombre en minúsculas sin tildes + un sufijo corto que la hace única. */
export function idLineaNueva(titulo: string, azar: () => string = () => Math.random().toString(36).slice(2, 8)): string {
  const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `lv-${base || "linea"}-${azar()}`;
}
