// Las categorías que el motor dibuja de una pregunta (CCSS-UI-3): la maqueta listaba todas las opciones del instrumento,
// y el PowerPoint no saca las que no tienen casos, las que el gráfico excluye ni, con tope, las que caen en «Otros».
// - Sin casos: el conteo de la base es 0 (`GET /api/graficos/categorias`); sin conteos no se descarta nada.
// - `excluir_opciones`: por código o por rótulo, como lo escribe el analista («88, 99»).
// - Tope: `top_k` en tortas y donas (`graficador_pie_dicotomico.R`, las k de mayor porcentaje y el resto en
//   `etiqueta_otros`), `max_categorias` en barras agrupadas (resto en «Otros» salvo `agrupar_resto_en_otros: false`).
// Puro: lo consume `fichaDeRanura`.

import type { OpcionMaqueta } from "../modeloMaqueta";

export type ConteoCategoria = { codigo: string; etiqueta: string; n: number };
export type CategoriasQueSalen = { opciones: OpcionMaqueta[]; fuera: string[] };

const lista = (x: unknown): string[] =>
  (Array.isArray(x) ? x : typeof x === "string" || typeof x === "number" ? String(x).split(",") : [])
    .map((t) => String(t).trim())
    .filter(Boolean);

const entero = (x: unknown): number | null => {
  const n = Number(Array.isArray(x) ? x[0] : x);
  return x !== null && x !== "" && Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

const clave = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Lee un arg del gráfico o de sus overrides (los overrides mandan, como en el motor). */
function lector(args: Readonly<Record<string, unknown>>): (k: string) => unknown {
  const ov = (args.overrides && typeof args.overrides === "object" ? args.overrides : {}) as Record<string, unknown>;
  return (k) => (k in ov ? ov[k] : args[k]);
}

function topeDe(graficador: string, v: (k: string) => unknown): { k: number; otros: string | null } | null {
  if (graficador === "p_pie" || graficador === "p_donut") {
    const k = entero(v("top_k"));
    const etiqueta = typeof v("etiqueta_otros") === "string" && (v("etiqueta_otros") as string).trim() ? (v("etiqueta_otros") as string).trim() : "Otros";
    return k ? { k, otros: etiqueta } : null;
  }
  if (graficador === "p_barras_agrupadas") {
    const k = entero(v("max_categorias"));
    if (!k) return null;
    const etiqueta = typeof v("etiqueta_otros") === "string" && (v("etiqueta_otros") as string).trim() ? (v("etiqueta_otros") as string).trim() : "Otros";
    return { k, otros: v("agrupar_resto_en_otros") === false ? null : etiqueta };
  }
  return null;
}

export function categoriasQueSalen(
  opciones: readonly OpcionMaqueta[],
  conteos: readonly ConteoCategoria[] | null | undefined,
  graficador: string,
  args: Readonly<Record<string, unknown>>,
): CategoriasQueSalen {
  const v = lector(args);
  const excluidas = new Set(lista(v("excluir_opciones")).map(clave));
  const nDe = (o: OpcionMaqueta): number | null => {
    if (!conteos?.length) return null;
    const c = conteos.find((x) => (o.codigo && x.codigo === o.codigo) || clave(x.etiqueta) === clave(o.rotulo));
    return c ? c.n : 0;
  };
  const fuera: string[] = [];
  const quedan = opciones.filter((o) => {
    if ((o.codigo && excluidas.has(clave(o.codigo))) || excluidas.has(clave(o.rotulo))) return false;
    if (nDe(o) === 0) { fuera.push(o.rotulo); return false; }
    return true;
  });
  const tope = topeDe(graficador, v);
  if (!tope || quedan.length <= tope.k || !conteos?.length) return { opciones: quedan, fuera };
  // Las k mayores, en el orden en que la maqueta ya las tenía; empate: la primera del instrumento.
  const rank = quedan.map((o, i) => ({ i, n: nDe(o) ?? 0 })).sort((a, b) => b.n - a.n || a.i - b.i);
  const mayores = new Set(rank.slice(0, tope.k).map((x) => x.i));
  const salen = quedan.filter((_, i) => mayores.has(i));
  return { opciones: tope.otros ? [...salen, { rotulo: tope.otros, color: null }] : salen, fuera };
}
