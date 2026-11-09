// Identidad › Rótulos cortos (U3, 2026-11-05; ranking del ADR 0141, 2026-11-09). Dos rankings por base, del rótulo más
// largo al más corto: "Preguntas" (`plan.rotulos_cortos.preguntas`, `base$var` → corto) y "Categorías" (el mapa de
// opciones, rótulo completo → corto). El ranking viene de GET /api/graficos/rotulos/ranking; el corto vigente se lee del
// store del plan, que es lo que guarda el autosave. Puro.

import {
  opcionesDeRotulos,
  preguntasDeRotulos,
  unirRotulos,
  type AvisoRotulos,
  type PedidoRotulos,
  type RankingBase,
  type RankingRotulos,
  type RotulosCortosPlan,
} from "../../../api/graficosRotulos";
import { formatoConteo } from "../../../lib/formatoNumero";

export type TipoRanking = "preguntas" | "categorias";

/** Una fila de un ranking: `clave` es la ref `base$var` de una pregunta o el rótulo completo de una categoría. */
export type FilaRanking = {
  tipo: TipoRanking;
  clave: string;
  /** Lo que se muestra junto al rótulo: la variable de la pregunta o la lista de la categoría. */
  detalle: string;
  etiqueta: string;
  largo: number;
  usos: number;
  /** El corto guardado en el plan, o "" si no tiene. */
  corto: string;
  /** El nombre corto que la pregunta lleva en algún gráfico, si sirve como sugerencia. Nunca se aplica solo. */
  sugerencia: string | null;
};

const espacios = (t: string) => t.replace(/\s+/g, " ").trim();
const plano = (t: string) => espacios(t).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const trasBase = (ref: string) => (ref.includes("$") ? ref.slice(ref.indexOf("$") + 1) : ref);

/** El corto de una categoría: por el rótulo exacto o, si no, con los espacios normalizados (como rotuloVisible). */
function cortoDeOpcion(mapa: Readonly<Record<string, string>>, etiqueta: string): string {
  if (Object.hasOwn(mapa, etiqueta)) return mapa[etiqueta];
  const clave = espacios(etiqueta);
  return Object.entries(mapa).find(([k]) => espacios(k) === clave)?.[1] ?? "";
}

/** Las filas de un ranking de una base, del rótulo más largo al más corto (orden estable). */
export function filasRanking(base: RankingBase | undefined, tipo: TipoRanking, rc: RotulosCortosPlan | undefined): FilaRanking[] {
  if (!base) return [];
  const filas: FilaRanking[] = tipo === "preguntas"
    ? (() => {
      const mapa = preguntasDeRotulos(rc);
      return base.preguntas.map((p) => {
        const corto = mapa[p.ref] ?? "";
        const s = p.corto_en_grafico?.trim() ?? "";
        const sugerencia = s && s !== corto && s.length < p.etiqueta.trim().length ? s : null;
        return { tipo, clave: p.ref, detalle: trasBase(p.ref), etiqueta: p.etiqueta, largo: p.largo, usos: p.usos, corto, sugerencia };
      });
    })()
    : (() => {
      const mapa = opcionesDeRotulos(rc);
      return base.opciones.map((o) => ({
        tipo, clave: o.etiqueta, detalle: trasBase(o.ref), etiqueta: o.etiqueta, largo: o.largo, usos: o.usos,
        corto: cortoDeOpcion(mapa, o.etiqueta), sugerencia: null,
      }));
    })();
  return filas.map((f, i) => ({ f, i })).sort((a, b) => b.f.largo - a.f.largo || a.i - b.i).map(({ f }) => f);
}

/** Las filas que coinciden con la búsqueda (sin tildes ni mayúsculas), en el rótulo, el corto o la variable. */
export function filtrarFilas(filas: readonly FilaRanking[], consulta: string): FilaRanking[] {
  const q = plano(consulta);
  if (!q) return [...filas];
  return filas.filter((f) => plano(f.etiqueta).includes(q) || plano(f.corto).includes(q) || plano(f.detalle).includes(q));
}

/** Qué impide guardar un corto, o `null` si se puede. Vacío se puede: quita el corto. Misma regla que el backend. */
export function errorCorto(etiqueta: string, borrador: string): string | null {
  const c = borrador.trim();
  if (!c) return null;
  const n = etiqueta.trim().length;
  if (c.length >= n) return `Debe ser más corto que el rótulo completo (${formatoConteo(n)} caracteres).`;
  return null;
}

export type Cambio = "nada" | "guardar" | "quitar";

/** Qué hace guardar un borrador en una fila. */
export function cambioDe(fila: FilaRanking, borrador: string): Cambio {
  const c = borrador.trim();
  if (c === fila.corto) return "nada";
  return c ? "guardar" : "quitar";
}

/** El cuerpo del POST: la sección completa de esa fila (una sección presente reemplaza la guardada) con el cambio. */
export function pedidoGuardar(rc: RotulosCortosPlan | undefined, fila: FilaRanking, borrador: string): PedidoRotulos {
  const c = borrador.trim();
  const actual = fila.tipo === "preguntas" ? preguntasDeRotulos(rc) : opcionesDeRotulos(rc);
  const seccion: Record<string, string | null> = { ...actual };
  if (fila.tipo === "categorias" && !Object.hasOwn(seccion, fila.clave)) {
    // El corto vigente puede venir de la clave con otros espacios: se reemplaza esa, no se duplica.
    const vieja = Object.keys(seccion).find((k) => espacios(k) === espacios(fila.clave));
    if (vieja) delete seccion[vieja];
  }
  if (c) seccion[fila.clave] = c;
  else delete seccion[fila.clave];
  return fila.tipo === "preguntas" ? { preguntas: seccion } : { opciones: seccion };
}

/** El plan con el cambio aplicado, para un estado intermedio o un test. */
export function rotulosCon(rc: RotulosCortosPlan | undefined, fila: FilaRanking, borrador: string): RotulosCortosPlan {
  const p = pedidoGuardar(rc, fila, borrador);
  const limpio = (m: Record<string, string | null>) =>
    Object.fromEntries(Object.entries(m).filter((e): e is [string, string] => typeof e[1] === "string"));
  return unirRotulos(p.opciones ? limpio(p.opciones) : opcionesDeRotulos(rc), p.preguntas ? limpio(p.preguntas) : preguntasDeRotulos(rc));
}

/** Categorías con corto guardado que ninguna base trae hoy (C5): el corto no se aplica; se pueden quitar. */
export function categoriasHuerfanas(rc: RotulosCortosPlan | undefined, ranking: RankingRotulos | null): FilaRanking[] {
  if (!ranking) return [];
  const presentes = new Set(ranking.bases.flatMap((b) => b.opciones.map((o) => espacios(o.etiqueta))));
  return Object.entries(opcionesDeRotulos(rc))
    .filter(([k]) => !presentes.has(espacios(k)))
    .map(([k, corto]) => ({ tipo: "categorias", clave: k, detalle: "", etiqueta: k, largo: k.length, usos: 0, corto, sugerencia: null }));
}

/** Clave única de una fila entre los dos rankings (borradores y errores del store de la vista). */
export const claveFila = (tipo: TipoRanking, clave: string) => `${tipo}:${clave}`;

/** La base que se muestra primero: la activa si está en el ranking, si no la primera. */
export function baseInicial(ranking: RankingRotulos | null, activa: string | null | undefined, elegida: string | null): string | null {
  const bases = ranking?.bases.map((b) => b.base) ?? [];
  if (elegida && bases.includes(elegida)) return elegida;
  if (activa && bases.includes(activa)) return activa;
  return bases[0] ?? null;
}

/** El aviso de colisión en palabras: el corto repetido y los rótulos que lo llevan. */
export function textoAviso(aviso: AvisoRotulos, etiquetaDe: (ref: string) => string): string {
  const quienes = aviso.refs.map((r) => `"${etiquetaDe(r)}"`).join(", ");
  const que = aviso.tipo === "preguntas" ? `${formatoConteo(aviso.refs.length)} preguntas${aviso.base ? ` de ${aviso.base}` : ""}` : `${formatoConteo(aviso.refs.length)} categorías`;
  return `"${aviso.corto}" es el rótulo corto de ${que}: ${quienes}.`;
}

/** Estado de la pieza en la columna de Identidad: cuántos rótulos cortos hay (categorías y preguntas). */
export function cuantosRotulos(rc: RotulosCortosPlan | undefined): number {
  return Object.keys(opcionesDeRotulos(rc)).length + Object.keys(preguntasDeRotulos(rc)).length;
}
