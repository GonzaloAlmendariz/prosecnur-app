/**
 * El ancho de la barra de un día en la serie de rendimiento.
 *
 * Estaba en línea y DUPLICADO en dos sitios del componente, con tope y sin
 * suelo: `Math.min((UTIL / (n - 1)) * 0.36, 4.5)`. Cada barra lleva CUATRO
 * elementos dentro —el tramo claro del techo, el oscuro de lo que el diseño
 * pedía, y sendas líneas en la vara y en el techo—, así que estrecharla sin
 * límite las funde.
 *
 * Medido sobre el viewBox de 0–100 con `preserveAspectRatio="none"` en ~900 px:
 * 20 días dan ~15,7 px, 45 dan ~6,8 y 60 dan **~5**. El registro de pulido ya
 * midió ese mismo modo de falla en el Ritmo diario de telefónico —«una columna
 * de barra apilada mide 7,9 px y sus tres segmentos piden 12»—, así que no es
 * una hipótesis.
 *
 * El suelo NO puede ser absoluto: con muchísimos días el paso entre centros se
 * hace menor que el suelo y las barras se pisarían, y dos barras pegadas se
 * leen como una sola. Se acota al paso.
 */
export const MARGEN_SERIE = 4;
export const UTIL_SERIE = 100 - MARGEN_SERIE * 2;

/** Ancho máximo: por encima la barra deja de leerse como marca de un día. */
const MAXIMO = 4.5;
/** Suelo de legibilidad, en unidades de viewBox (~11 px a 900 de ancho). */
const MINIMO = 1.2;

export function anchoDeBarraDelDia(dias: number): number {
  if (dias <= 1) return MAXIMO;
  const paso = UTIL_SERIE / (dias - 1);
  const base = Math.min(paso * 0.36, MAXIMO);
  // El suelo se aplica sólo mientras quepa: `paso` es la distancia entre
  // centros, así que una barra más ancha pisa a su vecina.
  return Math.min(Math.max(base, MINIMO), paso);
}
