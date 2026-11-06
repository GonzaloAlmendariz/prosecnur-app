// Franja de indicadores del diseño: los vacíos se juntan en una línea (L18).
//
// Con el diseño a medio hacer, la franja fijaba ocho casillas y cuatro decían «—»: medio panel de chrome que no
// informa nada. Desde dos vacíos, salen de la rejilla y se nombran juntos en una sola línea; con uno solo, su
// casilla se queda (colapsar un único «—» no ahorra nada y mueve la rejilla).

export type IndicadorConValor = { label: string; value: number | null; texto?: string };

export function esIndicadorVacio(indicador: IndicadorConValor): boolean {
  const texto = indicador.texto?.trim();
  if (texto && texto !== "—") return false;
  return indicador.value == null;
}

export function separarIndicadoresVacios<T extends IndicadorConValor>(
  indicadores: readonly T[],
): { conValor: T[]; vacios: T[] } {
  const vacios = indicadores.filter(esIndicadorVacio);
  if (vacios.length < 2) return { conValor: [...indicadores], vacios: [] };
  return { conValor: indicadores.filter((indicador) => !esIndicadorVacio(indicador)), vacios };
}
