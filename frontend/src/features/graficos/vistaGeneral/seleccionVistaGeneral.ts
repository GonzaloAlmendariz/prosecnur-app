// Multiselección de la Vista general (F6.3; inventario A0 C31). Pura y por id: reordenar no cambia qué está elegido.
// - clic: sólo esa lámina (y pasa a ser el ancla);
// - Ctrl/Cmd+clic (o Espacio con el teclado): la agrega o la quita, y pasa a ser el ancla;
// - Mayús+clic (o Mayús+flecha): el tramo entre el ancla y esa lámina, en el orden del plan; el ancla no se mueve.

export type SeleccionVistaGeneral = {
  /** Ids elegidos, en el orden del plan. */
  ids: string[];
  ancla: string | null;
};

export type ModoSeleccion = "unica" | "alternar" | "rango";

export const SELECCION_VACIA: SeleccionVistaGeneral = { ids: [], ancla: null };

const enOrden = (orden: readonly string[], elegidos: ReadonlySet<string>) => orden.filter((id) => elegidos.has(id));

export function seleccionar(actual: SeleccionVistaGeneral, id: string, modo: ModoSeleccion, orden: readonly string[]): SeleccionVistaGeneral {
  if (!orden.includes(id)) return actual;
  if (modo === "unica") return { ids: [id], ancla: id };
  if (modo === "alternar") {
    const elegidos = new Set(actual.ids);
    if (elegidos.has(id)) elegidos.delete(id);
    else elegidos.add(id);
    return { ids: enOrden(orden, elegidos), ancla: id };
  }
  const ancla = actual.ancla && orden.includes(actual.ancla) ? actual.ancla : id;
  const a = orden.indexOf(ancla);
  const b = orden.indexOf(id);
  const [desde, hasta] = a <= b ? [a, b] : [b, a];
  return { ids: orden.slice(desde, hasta + 1), ancla };
}

export function seleccionarTodo(orden: readonly string[]): SeleccionVistaGeneral {
  return { ids: [...orden], ancla: orden[0] ?? null };
}

/** Tras cambiar el plan: se olvidan las láminas que ya no están y el resto se reordena como el plan. */
export function reconciliarSeleccionVG(actual: SeleccionVistaGeneral, orden: readonly string[]): SeleccionVistaGeneral {
  const elegidos = new Set(actual.ids);
  const ids = enOrden(orden, elegidos);
  const ancla = actual.ancla && orden.includes(actual.ancla) ? actual.ancla : ids[0] ?? null;
  if (ids.length === actual.ids.length && ids.every((id, i) => id === actual.ids[i]) && ancla === actual.ancla) return actual;
  return { ids, ancla };
}

/**
 * Sobre qué actúan arrastrar y las acciones en bloque: la selección si incluye la lámina tocada; si no, sólo esa
 * lámina (arrastrar una tarjeta no elegida no se lleva consigo una selección ajena).
 */
export function objetivoDeAccion(actual: SeleccionVistaGeneral, id: string | null): string[] {
  if (id && !actual.ids.includes(id)) return [id];
  return actual.ids.length ? [...actual.ids] : id ? [id] : [];
}
