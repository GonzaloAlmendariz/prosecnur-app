/**
 * Geometría de las tablas de Equivalencias con N bases (U2, ronda de claridad).
 *
 * Una sola regla para cualquier cantidad de bases y cualquier nombre: cada
 * columna de base tiene un ancho fijo legible y la tabla un mínimo que crece con
 * N. Si no cabe, el marco se desplaza en horizontal con la columna del tema
 * fija (lo mide `useDesbordeHorizontal`). El reparto en porcentaje que había
 * antes encogía cada columna con cada base nueva: con siete bases, 6 % de la
 * tabla.
 *
 * Lógica pura: el componente sólo aplica lo que este módulo decide.
 */

/** Ancho fijo de una columna de base en la Lista, en px. */
export const ANCHO_COLUMNA_BASE_PX = 132;

export function anchoColumnaPublico(): string {
  return `${ANCHO_COLUMNA_BASE_PX}px`;
}

/** Ancho mínimo de la Lista: etiqueta, diapositiva, las N bases, cobertura y acciones. */
export function anchoMinimoLista(nBases: number): number {
  const etiqueta = 260;
  const diapositiva = 84;
  const cobertura = 72;
  const acciones = 72;
  return etiqueta + diapositiva + Math.max(0, nBases) * ANCHO_COLUMNA_BASE_PX + cobertura + acciones;
}

export type CoberturaDeBases = {
  presentes: string[];
  faltantes: string[];
  /** Lo que se lee: «3 de 7». Vale igual con 2 bases que con 20. */
  texto: string;
  /** Lo que se dice al pasar o con lector: qué bases tienen la pregunta y cuáles no. */
  detalle: string;
};

export function coberturaDeBases(
  bases: readonly string[],
  variables: Record<string, string | undefined>,
): CoberturaDeBases {
  const presentes = bases.filter((b) => Boolean(variables[b]));
  const faltantes = bases.filter((b) => !variables[b]);
  const detalle = presentes.length === 0
    ? "Ninguna base tiene esta pregunta."
    : faltantes.length === 0
      ? "Está en todas las bases."
      : `Está en ${presentes.join(", ")}. Falta en ${faltantes.join(", ")}.`;
  return { presentes, faltantes, texto: `${presentes.length} de ${bases.length}`, detalle };
}
