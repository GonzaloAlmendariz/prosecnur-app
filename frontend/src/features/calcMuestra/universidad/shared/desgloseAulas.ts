/**
 * De qué está hecho el número de aulas titulares.
 *
 * La tira decía «AULAS QUE PIDE EL CÁLCULO · 174» y ese 174 es la suma de tres
 * decisiones distintas que se veían como una sola cifra. Gonzalo, 2026-08-27:
 * «el 165 cambiar a 174 tomando en cuenta el porqué de las aulas extra,
 * separando las de certeza de las extra operativas».
 *
 * En HSVG 2026 el reparto es 165 + 8 + 1: la fórmula pide 165; la
 * certificación por facultad sube ocho aulas en seis facultades (Derecho +2,
 * EG Letras +2, Contables +1, Gestión +1, Letras +1, Psicología +1); y una
 * agregación operativa suma la novena en Derecho, donde la certeza pide 18 y el
 * diseño lleva 19.
 *
 * El reparto se deriva de tres campos del propio motor y no de los rótulos:
 * `aulas_formula` (lo que pide la división), `aulas_base_certificada` (hasta
 * dónde llegó la certificación) y `aulas_base` (lo que se va a sortear). Leer
 * `aulas_base_origen` en su lugar no alcanza —es un solo campo y sólo nombra
 * UN dueño—, que es justo por lo que existe `aulas_base_certificada`.
 */
import type { CalcMuestraAulasEstrato } from "../../../../api/client";

export type DesgloseAulas = {
  /** Lo que pide `cuota / (divisor × tau)` en todos los estratos. */
  formula: number;
  /** Lo que la certificación por facultad sumó sobre la fórmula. */
  certeza: number;
  /** Lo que el analista sumó por juicio, sobre lo anterior. */
  operativa: number;
  /**
   * Lo que se apartó de la fórmula SIN declarar de dónde sale. No se reparte
   * entre las otras dos: atribuirlo sería inventar una decisión. Aparece en
   * proyectos anteriores a `aulas_base_origen` —el componente de Facultades de
   * HSVG 2026 tiene quince fijaciones así, que suman 174—.
   */
  sinDeclarar: number;
  /**
   * Lo que quedó POR DEBAJO de la fórmula. Negativo por construcción. La regla
   * de la casa es no bajar ninguna, así que si esto no es cero hay algo que
   * mirar, y callarlo haría que las partes no sumaran el total.
   */
  recorte: number;
  /** La suma de `aulas_base`. Siempre igual a la suma de las partes. */
  total: number;
};

const VACIO: DesgloseAulas = {
  formula: 0, certeza: 0, operativa: 0, sinDeclarar: 0, recorte: 0, total: 0,
};

function entero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * `null` cuando el reparto no publica `aulas_formula` —resultados anteriores al
 * campo—: sin saber qué pedía la fórmula no hay descomposición posible, y un
 * desglose que atribuye todo a la fórmula por defecto diría que nadie decidió
 * nada.
 */
export function desglosarAulas(
  filas: readonly CalcMuestraAulasEstrato[] | null | undefined,
): DesgloseAulas | null {
  if (!Array.isArray(filas) || filas.length === 0) return null;
  if (!filas.some((f) => Number.isFinite(Number(f?.aulas_formula)))) return null;

  const out = { ...VACIO };
  for (const fila of filas) {
    const base = entero(fila?.aulas_base);
    const formula = entero(fila?.aulas_formula);
    out.total += base;
    out.formula += formula;
    if (base === formula) continue;
    if (base < formula) {
      out.recorte += base - formula;
      continue;
    }
    // La certificación sólo cuenta hasta donde llegó, y nunca por encima de lo
    // que se va a sortear: un nivel certificado mayor que la base significa que
    // alguien decidió quedarse por debajo, no que la certificación pidió eso.
    const certificada = Math.min(entero(fila?.aulas_base_certificada), base);
    if (certificada > formula) {
      out.certeza += certificada - formula;
      out.operativa += base - certificada;
      continue;
    }
    // Sin nivel certificado, el apartamiento lo nombra el origen; si tampoco lo
    // declara, se dice que no está declarado en vez de repartirlo.
    if (fila?.aulas_base_origen === "operativa") out.operativa += base - formula;
    else if (fila?.aulas_base_origen === "certificacion") out.certeza += base - formula;
    else out.sinDeclarar += base - formula;
  }
  return out;
}

/** Las partes que valen algo, en el orden en que se decidieron. */
export function partesDelDesglose(d: DesgloseAulas): Array<{
  clave: "formula" | "certeza" | "operativa" | "sinDeclarar" | "recorte";
  valor: number;
  etiqueta: string;
}> {
  const partes = [
    { clave: "formula", valor: d.formula, etiqueta: "fórmula" },
    { clave: "certeza", valor: d.certeza, etiqueta: "certeza" },
    { clave: "operativa", valor: d.operativa, etiqueta: "operativa" },
    { clave: "sinDeclarar", valor: d.sinDeclarar, etiqueta: "sin declarar" },
    { clave: "recorte", valor: d.recorte, etiqueta: "por debajo" },
  ] as const;
  // La fórmula se muestra siempre —es el punto de partida y sin ella el
  // desglose no se lee—; las demás sólo cuando aportaron algo.
  return partes
    .filter((p) => p.clave === "formula" || p.valor !== 0)
    .map((p) => ({ ...p }));
}
