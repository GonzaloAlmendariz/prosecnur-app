// Quién manda sobre la lámina seleccionada (F6.1, parte 2): la URL (`foco=l-NN`) o el plan (`selectedSlideId`).
//
// `foco` es posicional: al mover, duplicar, insertar o eliminar, la lámina 14 pasa a ser otra. Si la URL mandara
// siempre, mover la lámina con Alt+↑ seleccionaría a su vecina. Regla: cuando el `foco` acaba de cambiar (enlace,
// clic, flechas), manda la URL y se selecciona esa lámina; si lo que cambió fue el plan, manda la lámina seleccionada y
// el `foco` se reescribe a su nueva posición.

export type Reconciliacion = {
  /** Posición 1-based que se muestra, o null con el plan vacío. */
  posicion: number | null;
  /** Id que hay que pasar a `select()`, si cambia. */
  seleccionar: string | null;
  /** El `foco` de la URL no dice la posición mostrada y hay que reescribirlo. */
  escribirFoco: boolean;
};

export function reconciliarSeleccion({ ids, focoPos, focoCambio, selectedId }: {
  ids: readonly string[];
  focoPos: number | null;
  /** El `foco` es distinto del que se vio en la reconciliación anterior (o es la primera). */
  focoCambio: boolean;
  selectedId: string | null;
}): Reconciliacion {
  const n = ids.length;
  if (n === 0) return { posicion: null, seleccionar: null, escribirFoco: false };
  const focoValido = focoPos !== null && focoPos >= 1 && focoPos <= n;
  const posSel = selectedId ? ids.indexOf(selectedId) + 1 : 0;

  if (focoCambio && focoValido) {
    const id = ids[focoPos - 1];
    return { posicion: focoPos, seleccionar: id !== selectedId ? id : null, escribirFoco: false };
  }
  if (posSel > 0) return { posicion: posSel, seleccionar: null, escribirFoco: focoPos !== posSel };
  if (focoValido) return { posicion: focoPos, seleccionar: ids[focoPos - 1], escribirFoco: false };
  return { posicion: 1, seleccionar: ids[0], escribirFoco: true };
}

/** La vecina que queda seleccionada al eliminar: la siguiente, o la anterior si era la última. */
export function vecinaAlEliminar(ids: readonly string[], id: string): string | null {
  const i = ids.indexOf(id);
  if (i < 0) return null;
  return ids[i + 1] ?? ids[i - 1] ?? null;
}
