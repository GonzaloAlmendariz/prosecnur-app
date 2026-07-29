// Selección y arrastre en un lienzo espacial (ADR 0047).
//
// Destilado de `features/graficos/v2/canvas/PlanCanvas.tsx`, que ya resolvía
// bien la semántica —Shift+Click alterna, el fondo limpia, el arrastre de grupo
// preserva offsets— pero acoplada a su dominio.
//
// Todo puro: el componente cablea, estas funciones deciden.

export type Caja = { x: number; y: number; w: number; h: number };
export type Rect = { x0: number; y0: number; x1: number; y1: number };

/**
 * Umbral en píxeles para distinguir un clic de un arrastre.
 *
 * Sin él, el temblor natural de la mano convierte cada clic en un micro-drag y
 * la selección nunca ocurre.
 */
export const UMBRAL_ARRASTRE = 4;

export function esArrastre(dx: number, dy: number, umbral = UMBRAL_ARRASTRE): boolean {
  return Math.abs(dx) + Math.abs(dy) > umbral;
}

/**
 * Nueva selección tras un clic.
 *
 * Con modificador alterna (agregar o quitar); sin él, reemplaza — salvo que el
 * elemento YA esté en una selección múltiple, en cuyo caso se respeta: hacer
 * clic sobre uno de varios elementos elegidos para arrastrarlos todos no debe
 * deshacer la selección.
 */
export function alternarSeleccion(
  actual: ReadonlySet<string>,
  id: string,
  conModificador: boolean,
): Set<string> {
  if (conModificador) {
    const siguiente = new Set(actual);
    if (siguiente.has(id)) siguiente.delete(id);
    else siguiente.add(id);
    return siguiente;
  }
  if (actual.has(id) && actual.size > 1) return new Set(actual);
  return new Set([id]);
}

export function normalizarRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x0: Math.min(a.x, b.x),
    y0: Math.min(a.y, b.y),
    x1: Math.max(a.x, b.x),
    y1: Math.max(a.y, b.y),
  };
}

/** Intersección, no contención: rozar un nodo con el marco lo selecciona. */
export function intersecta(caja: Caja, rect: Rect): boolean {
  return (
    caja.x < rect.x1 &&
    caja.x + caja.w > rect.x0 &&
    caja.y < rect.y1 &&
    caja.y + caja.h > rect.y0
  );
}

export function seleccionEnRectangulo(
  cajas: ReadonlyMap<string, Caja>,
  rect: Rect,
  previa?: ReadonlySet<string>,
): Set<string> {
  // Con selección previa el marco SUMA: es lo que permite armar una selección
  // en dos pasadas sin perder la primera.
  const out = new Set(previa ?? []);
  for (const [id, caja] of cajas) {
    if (intersecta(caja, rect)) out.add(id);
  }
  return out;
}

export type PosicionesIniciales = ReadonlyMap<string, { x: number; y: number }>;

/**
 * Posiciones tras arrastrar una selección.
 *
 * Se parte de las posiciones INICIALES y no de las actuales para que el
 * arrastre no acumule error: sumar el delta de cada frame a lo anterior
 * deriva, y un grupo movido lejos termina desalineado respecto del cursor.
 */
export function aplicarArrastre(
  iniciales: PosicionesIniciales,
  dx: number,
  dy: number,
  ajustar?: (v: number) => number,
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  for (const [id, p] of iniciales) {
    const x = p.x + dx;
    const y = p.y + dy;
    out.set(id, ajustar ? { x: ajustar(x), y: ajustar(y) } : { x, y });
  }
  return out;
}

export type Direccion = "arriba" | "abajo" | "izquierda" | "derecha";

/**
 * Nodo más cercano en una dirección, para navegar con flechas.
 *
 * Puntúa la distancia en el eje del movimiento y penaliza la desviación
 * perpendicular: sin la penalización, "derecha" saltaría a un nodo lejano en
 * diagonal antes que al de al lado.
 */
export function siguienteEnDireccion(
  cajas: ReadonlyMap<string, Caja>,
  desde: string,
  direccion: Direccion,
): string | null {
  const origen = cajas.get(desde);
  if (!origen) return null;
  const cx = origen.x + origen.w / 2;
  const cy = origen.y + origen.h / 2;

  let mejor: string | null = null;
  let mejorPuntaje = Infinity;

  for (const [id, caja] of cajas) {
    if (id === desde) continue;
    const dx = caja.x + caja.w / 2 - cx;
    const dy = caja.y + caja.h / 2 - cy;

    const avance =
      direccion === "derecha" ? dx :
      direccion === "izquierda" ? -dx :
      direccion === "abajo" ? dy : -dy;
    if (avance <= 0) continue;

    const desvio = direccion === "derecha" || direccion === "izquierda" ? Math.abs(dy) : Math.abs(dx);
    const puntaje = avance + desvio * 2;
    if (puntaje < mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = id;
    }
  }
  return mejor;
}

/**
 * Orden de tabulación: de arriba a abajo, y a igual altura de izquierda a
 * derecha. Es cómo se lee un lienzo, y por lo tanto cómo debe recorrerlo `Tab`.
 */
export function ordenDeLectura(cajas: ReadonlyMap<string, Caja>): string[] {
  return [...cajas.entries()]
    .sort(([, a], [, b]) => (a.y === b.y ? a.x - b.x : a.y - b.y))
    .map(([id]) => id);
}

export function siguienteEnOrden(orden: readonly string[], actual: string | null, paso: 1 | -1): string | null {
  if (orden.length === 0) return null;
  if (actual === null) return paso === 1 ? orden[0] : orden[orden.length - 1];
  const i = orden.indexOf(actual);
  if (i === -1) return orden[0];
  // Envuelve: llegar al final con Tab vuelve al principio en vez de dejar al
  // usuario sin salida.
  return orden[(i + paso + orden.length) % orden.length];
}
