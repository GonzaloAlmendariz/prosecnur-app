// Selección múltiple de respuestas en la vista de tarjetas de Codificar (etapa P3c).
//
// Pura y por clave (`texto_normalizado`): buscar, filtrar o reordenar no cambia qué está elegido.
// - clic: solo esa respuesta, que pasa a ser el ancla;
// - Cmd o Ctrl y clic: la agrega o la quita, y pasa a ser el ancla;
// - Mayús y clic (o Mayús y flecha): el tramo entre el ancla y esa respuesta, en el orden de la lista.
// El cursor es la respuesta que tiene el foco del teclado; las flechas lo mueven.

export type SeleccionRespuestas = {
  /** Claves elegidas, en el orden de la lista. */
  claves: string[];
  /** Desde dónde se mide un tramo. */
  ancla: string | null;
  /** La respuesta con el foco del teclado. */
  cursor: string | null;
};

export type ModoDeSeleccion = "unica" | "alternar" | "rango";

export const SELECCION_VACIA: SeleccionRespuestas = { claves: [], ancla: null, cursor: null };

const enOrden = (orden: readonly string[], elegidas: ReadonlySet<string>) => orden.filter((clave) => elegidas.has(clave));

/** Qué pide un clic según sus teclas: Mayús manda sobre Cmd o Ctrl. */
export function modoDeClic(evento: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }): ModoDeSeleccion {
  if (evento.shiftKey) return "rango";
  return evento.metaKey || evento.ctrlKey ? "alternar" : "unica";
}

export function seleccionar(
  actual: SeleccionRespuestas,
  clave: string,
  modo: ModoDeSeleccion,
  orden: readonly string[],
): SeleccionRespuestas {
  if (!orden.includes(clave)) return actual;
  if (modo === "unica") return { claves: [clave], ancla: clave, cursor: clave };
  if (modo === "alternar") {
    const elegidas = new Set(actual.claves);
    if (elegidas.has(clave)) elegidas.delete(clave);
    else elegidas.add(clave);
    return { claves: enOrden(orden, elegidas), ancla: clave, cursor: clave };
  }
  const ancla = actual.ancla !== null && orden.includes(actual.ancla) ? actual.ancla : clave;
  const a = orden.indexOf(ancla);
  const b = orden.indexOf(clave);
  const [desde, hasta] = a <= b ? [a, b] : [b, a];
  return { claves: orden.slice(desde, hasta + 1), ancla, cursor: clave };
}

export type DestinoDelCursor = 1 | -1 | "inicio" | "fin";

/**
 * Mueve el cursor con el teclado. Sin `extender`, la selección pasa a la respuesta de destino; con
 * `extender` (Mayús) se elige el tramo desde el ancla. En los extremos se queda donde está.
 */
export function moverCursor(
  actual: SeleccionRespuestas,
  destino: DestinoDelCursor,
  orden: readonly string[],
  extender: boolean,
): SeleccionRespuestas {
  if (orden.length === 0) return actual;
  const ultimo = orden.length - 1;
  const i = actual.cursor === null ? -1 : orden.indexOf(actual.cursor);
  let j: number;
  if (destino === "inicio") j = 0;
  else if (destino === "fin") j = ultimo;
  else if (i < 0) j = destino === 1 ? 0 : ultimo;
  else j = Math.min(ultimo, Math.max(0, i + destino));
  return seleccionar(actual, orden[j], extender ? "rango" : "unica", orden);
}

export function seleccionarTodo(orden: readonly string[], actual: SeleccionRespuestas = SELECCION_VACIA): SeleccionRespuestas {
  if (orden.length === 0) return SELECCION_VACIA;
  const cursor = actual.cursor !== null && orden.includes(actual.cursor) ? actual.cursor : orden[0];
  return { claves: [...orden], ancla: orden[0], cursor };
}

/** Suelta la selección y deja el cursor donde estaba. */
export function soltarSeleccion(actual: SeleccionRespuestas): SeleccionRespuestas {
  return actual.claves.length === 0 ? actual : { claves: [], ancla: actual.cursor, cursor: actual.cursor };
}

/**
 * Tras cambiar la lista (una búsqueda, el filtro, una respuesta que recibió su código y salió de "Por
 * codificar"): se olvidan las claves que ya no están. Sin cambios devuelve el mismo objeto.
 */
export function reconciliarSeleccion(actual: SeleccionRespuestas, orden: readonly string[]): SeleccionRespuestas {
  const presentes = new Set(orden);
  const claves = actual.claves.filter((clave) => presentes.has(clave));
  const ancla = actual.ancla !== null && presentes.has(actual.ancla) ? actual.ancla : null;
  const cursor = actual.cursor !== null && presentes.has(actual.cursor) ? actual.cursor : null;
  if (claves.length === actual.claves.length && ancla === actual.ancla && cursor === actual.cursor) return actual;
  return { claves, ancla, cursor };
}

/**
 * Sobre qué respuestas actúa un arrastre: la selección si incluye la respuesta que se levanta; si no,
 * solo esa (arrastrar una fila no elegida no se lleva una selección ajena).
 */
export function respuestasLevantadas(actual: SeleccionRespuestas, clave: string): string[] {
  return actual.claves.includes(clave) ? [...actual.claves] : [clave];
}

/**
 * A dónde pasa la selección después de asignar con el teclado: la siguiente respuesta sin código después
 * de la última asignada y, si abajo no queda ninguna, la primera de arriba. Sin ninguna, se suelta la
 * selección y el cursor se queda en la última asignada.
 */
export function seleccionTrasAsignar(
  asignadas: readonly string[],
  orden: readonly string[],
  tieneCodigo: (clave: string) => boolean,
): SeleccionRespuestas {
  const hechas = new Set(asignadas);
  const ultima = asignadas.length ? asignadas[asignadas.length - 1] : null;
  const i = ultima === null ? -1 : orden.indexOf(ultima);
  const candidatas = [...orden.slice(i + 1), ...orden.slice(0, Math.max(0, i))];
  const siguiente = candidatas.find((clave) => !hechas.has(clave) && !tieneCodigo(clave));
  if (siguiente !== undefined) return { claves: [siguiente], ancla: siguiente, cursor: siguiente };
  const cursor = ultima !== null && orden.includes(ultima) ? ultima : null;
  return { claves: [], ancla: cursor, cursor };
}

/**
 * Alterna varias claves a la vez (la casilla de la tabla, la de una fila que junta parecidas o la de
 * elegir todas): las que estaban elegidas salen y las demás entran, en el orden de la lista.
 */
export function alternarVarias(actual: SeleccionRespuestas, claves: readonly string[], orden: readonly string[]): SeleccionRespuestas {
  const validas = claves.filter((c) => orden.includes(c));
  if (validas.length === 0) return actual;
  const elegidas = new Set(actual.claves);
  for (const c of validas) {
    if (elegidas.has(c)) elegidas.delete(c);
    else elegidas.add(c);
  }
  const ultima = validas[validas.length - 1];
  return { claves: enOrden(orden, elegidas), ancla: ultima, cursor: ultima };
}
