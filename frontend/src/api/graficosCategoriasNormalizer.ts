// Normalizador defensivo de GET /api/graficos/categorias (contrato D8 §7). Plumber/jsonlite desempacan vectores de uno
// a escalares y pueden mandar `null` en lugar de listas vacías; la tarjeta «Orden» no debe romperse por eso.

export type ModoRecetario = "frecuencia" | "instrumento" | "personalizado";

export type CategoriaGrafico = { codigo: string; etiqueta: string; n: number; pct: number | null; residual: boolean };

export type GraficosCategorias = {
  var: string;
  base: string;
  pregunta: string;
  ordinal: boolean;
  tipo: string;
  /** El modo que «recetario» aplica a este dato. */
  modo_recetario: ModoRecetario | null;
  /** En orden del instrumento. */
  categorias: CategoriaGrafico[];
  /** Códigos en el orden que dibuja cada modo (sin invertir), residuales al final. */
  orden: { recetario: string[]; instrumento: string[]; frecuencia: string[] };
};

const texto = (v: unknown): string => {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "string" ? x : typeof x === "number" && Number.isFinite(x) ? String(x) : "";
};
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === null || v === undefined ? [] : [v]);
const codigos = (v: unknown): string[] => lista(v).map(texto).filter(Boolean);
const numero = (v: unknown): number | null => {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "number" && Number.isFinite(x) ? x : null;
};
const verdad = (v: unknown): boolean => (Array.isArray(v) ? v[0] : v) === true;

export function normalizeGraficosCategorias(raw: unknown): GraficosCategorias {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const vistos = new Set<string>();
  const categorias: CategoriaGrafico[] = [];
  for (const c of lista(r.categorias)) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const codigo = texto(o.codigo);
    if (!codigo || vistos.has(codigo)) continue;
    vistos.add(codigo);
    categorias.push({ codigo, etiqueta: texto(o.etiqueta) || codigo, n: numero(o.n) ?? 0, pct: numero(o.pct), residual: verdad(o.residual) });
  }
  const ord = r.orden && typeof r.orden === "object" ? (r.orden as Record<string, unknown>) : {};
  const soloExistentes = (v: unknown) => codigos(v).filter((k) => vistos.has(k));
  const modo = texto(r.modo_recetario);
  return {
    var: texto(r.var),
    base: texto(r.base),
    pregunta: texto(r.pregunta),
    ordinal: verdad(r.ordinal),
    tipo: texto(r.tipo),
    modo_recetario: modo === "frecuencia" || modo === "instrumento" || modo === "personalizado" ? modo : null,
    categorias,
    orden: { recetario: soloExistentes(ord.recetario), instrumento: soloExistentes(ord.instrumento), frecuencia: soloExistentes(ord.frecuencia) },
  };
}
