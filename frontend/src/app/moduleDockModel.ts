/**
 * Reparto del dock de módulos del header (L35, remasterización 2026-10-10 §5.1).
 *
 * El dock mide lo que sus módulos: no hay tope fijo de ancho. El tope
 * `min(328px, 32vw)` que tenía dejaba escapar «Agregar» por el borde con los
 * ocho módulos agregados (nueve tiles de 39 px = 351 px) porque el contenedor
 * era `overflow: visible`.
 *
 * Cuando el ancho del header NO alcanza para todos, se aplica el overflow con
 * dignidad de la v3 (ADR 0042 §4): nada se cae; los módulos que no caben se
 * recogen en un menú «Más módulos» al final, antes de «Agregar». Dos destinos
 * no se recogen nunca:
 *
 * - el módulo activo, que además lleva su nombre visible (el «dónde estás»);
 * - «Agregar», que es justamente el tile que se escapaba.
 *
 * La decisión depende del ancho medido, no de un conteo: con ocho módulos más
 * «Agregar» (nueve destinos) caben de sobra a 1440 y a 1024, y a la vez una
 * ventana estrecha con seis módulos también necesita recoger.
 */

export type DockGeometria = {
  /** Ancho de un tile compacto más el gap del dock. */
  paso: number;
  /** Ancho del tile activo con su nombre, más el gap. */
  anchoActivo: number;
  /** Padding + borde del propio dock (ambos lados). */
  marco: number;
};

/** Valores de `module-dock.css` para cuando aún no hay medida del DOM. */
export const DOCK_GEOMETRIA_POR_DEFECTO: DockGeometria = {
  paso: 39,
  anchoActivo: 132,
  marco: 8,
};

export type RepartoDock<T> = {
  visibles: T[];
  ocultos: T[];
};

/** Ancho que pide el dock entero sin recoger nada (incluye «Agregar»). */
export function anchoNaturalDock(
  inactivos: number,
  hayActivo: boolean,
  geometria: DockGeometria = DOCK_GEOMETRIA_POR_DEFECTO,
): number {
  return (
    geometria.marco +
    inactivos * geometria.paso +
    (hayActivo ? geometria.anchoActivo : 0) +
    geometria.paso // «Agregar»
  );
}

/**
 * Reparte los módulos entre el dock y el menú «Más módulos».
 *
 * @param cupo ancho disponible para el dock en px; `null` = sin medir (SSR o
 *   primer render) y entonces no se recoge nada.
 */
export function repartirDock<T extends { to: string }>(
  items: readonly T[],
  activoTo: string,
  cupo: number | null,
  geometria: DockGeometria = DOCK_GEOMETRIA_POR_DEFECTO,
): RepartoDock<T> {
  const hayActivo = items.some((item) => item.to === activoTo);
  const inactivos = items.filter((item) => item.to !== activoTo);
  if (cupo == null || anchoNaturalDock(inactivos.length, hayActivo, geometria) <= cupo) {
    return { visibles: [...items], ocultos: [] };
  }

  // Lo fijo: marco, activo, «Agregar» y el propio disparador «Más módulos».
  const fijo =
    geometria.marco +
    (hayActivo ? geometria.anchoActivo : 0) +
    geometria.paso + // «Agregar»
    geometria.paso; // «Más módulos»
  const caben = Math.max(0, Math.floor((cupo - fijo) / geometria.paso));
  const quedan = new Set(inactivos.slice(0, caben).map((item) => item.to));

  const visibles: T[] = [];
  const ocultos: T[] = [];
  for (const item of items) {
    if (item.to === activoTo || quedan.has(item.to)) visibles.push(item);
    else ocultos.push(item);
  }
  return { visibles, ocultos };
}
