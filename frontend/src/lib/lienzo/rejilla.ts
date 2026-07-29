// Rejilla y guías de alineación de un lienzo (ADR 0047).
//
// Destilado del snap de `graficos/v2/canvas/planAutoLayout.ts`. Puro.

export const GRILLA_POR_DEFECTO = 16;

/** Umbral de imantación de una guía, en píxeles de mundo. */
export const TOLERANCIA_GUIA = 6;

export function ajustarAGrilla(valor: number, grilla = GRILLA_POR_DEFECTO): number {
  if (grilla <= 0) return valor;
  return Math.round(valor / grilla) * grilla;
}

export type Caja = { x: number; y: number; w: number; h: number };

export type Guia = { eje: "x" | "y"; valor: number };

/**
 * Guías contra las que alinear la caja que se arrastra.
 *
 * Se comparan bordes y centros: alinear por el centro es lo que la gente hace a
 * ojo, y alinear por el borde es lo que produce columnas.
 *
 * Devuelve solo las guías que están DENTRO de la tolerancia, así el componente
 * pinta exactamente las que están imantando y no una maraña.
 */
export function guiasCercanas(
  movil: Caja,
  otras: readonly Caja[],
  tolerancia = TOLERANCIA_GUIA,
): Guia[] {
  const candidatasX = [movil.x, movil.x + movil.w / 2, movil.x + movil.w];
  const candidatasY = [movil.y, movil.y + movil.h / 2, movil.y + movil.h];

  const guias: Guia[] = [];
  const vistas = new Set<string>();

  for (const otra of otras) {
    for (const valor of [otra.x, otra.x + otra.w / 2, otra.x + otra.w]) {
      if (candidatasX.some((c) => Math.abs(c - valor) <= tolerancia)) {
        const clave = `x:${valor}`;
        if (!vistas.has(clave)) {
          vistas.add(clave);
          guias.push({ eje: "x", valor });
        }
      }
    }
    for (const valor of [otra.y, otra.y + otra.h / 2, otra.y + otra.h]) {
      if (candidatasY.some((c) => Math.abs(c - valor) <= tolerancia)) {
        const clave = `y:${valor}`;
        if (!vistas.has(clave)) {
          vistas.add(clave);
          guias.push({ eje: "y", valor });
        }
      }
    }
  }
  return guias;
}

/**
 * Desplazamiento que imanta la caja a las guías más cercanas.
 *
 * Se elige la guía más próxima por eje, no la primera encontrada: con varias
 * dentro de la tolerancia, saltar a una lejana se siente como un tirón.
 */
export function imantar(
  movil: Caja,
  guias: readonly Guia[],
): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  let mejorX = Infinity;
  let mejorY = Infinity;

  for (const guia of guias) {
    if (guia.eje === "x") {
      for (const borde of [movil.x, movil.x + movil.w / 2, movil.x + movil.w]) {
        const d = guia.valor - borde;
        if (Math.abs(d) < Math.abs(mejorX)) mejorX = d;
      }
    } else {
      for (const borde of [movil.y, movil.y + movil.h / 2, movil.y + movil.h]) {
        const d = guia.valor - borde;
        if (Math.abs(d) < Math.abs(mejorY)) mejorY = d;
      }
    }
  }
  if (Number.isFinite(mejorX)) dx = mejorX;
  if (Number.isFinite(mejorY)) dy = mejorY;
  return { dx, dy };
}

/**
 * Posición libre para un nodo nuevo cerca de una referencia.
 *
 * Busca en espiral para no apilar nodos uno encima de otro: crear tres nodos
 * seguidos tiene que dejarlos visibles, no superpuestos.
 */
export function posicionLibre(
  ancla: { x: number; y: number },
  tamano: { w: number; h: number },
  ocupadas: readonly Caja[],
  paso = 24,
): { x: number; y: number } {
  const choca = (x: number, y: number) =>
    ocupadas.some(
      (c) => x < c.x + c.w && x + tamano.w > c.x && y < c.y + c.h && y + tamano.h > c.y,
    );

  if (!choca(ancla.x, ancla.y)) return { x: ancla.x, y: ancla.y };

  for (let anillo = 1; anillo <= 24; anillo += 1) {
    const d = anillo * paso;
    const candidatos = [
      { x: ancla.x + d, y: ancla.y },
      { x: ancla.x, y: ancla.y + d },
      { x: ancla.x + d, y: ancla.y + d },
      { x: ancla.x - d, y: ancla.y },
      { x: ancla.x, y: ancla.y - d },
      { x: ancla.x - d, y: ancla.y + d },
    ];
    for (const c of candidatos) {
      if (!choca(c.x, c.y)) return c;
    }
  }
  // Tras 24 anillos, apilar es preferible a no crear el nodo.
  return { x: ancla.x + paso, y: ancla.y + paso };
}
