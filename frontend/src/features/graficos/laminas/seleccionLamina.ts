// Quién manda sobre la lámina seleccionada (F6.1, parte 2): la URL (`foco=<id>`) o el plan (`selectedSlideId`).
//
// `foco` nombra el id de la lámina (`../focoLamina.ts`), así que mover, duplicar o insertar no lo desvía: tras Alt+↑ el
// enlace sigue en la misma lámina. Regla: cuando el `foco` acaba de cambiar (enlace, clic, flechas) manda la URL y se
// selecciona esa lámina; si lo que cambió fue el plan, manda la lámina seleccionada y el `foco` se reescribe sólo si no
// la nombra (duplicar elige la copia, eliminar la vecina). Un `foco` heredado `l-NN` se resuelve por posición UNA vez y
// se reescribe al id.

export type Reconciliacion = {
  /** Posición 1-based que se muestra, o null con el plan vacío. */
  posicion: number | null;
  /** Id que hay que pasar a `select()`, si cambia. */
  seleccionar: string | null;
  /** El `foco` de la URL no es el id de la lámina mostrada (o vino heredado) y hay que reescribirlo. */
  escribirFoco: boolean;
};

export function reconciliarSeleccion({ ids, focoId, focoHeredado = false, focoCambio, selectedId }: {
  ids: readonly string[];
  /** Id que nombra el `foco` ya resuelto (`resolverFocoLamina`), o null si no nombra ninguna lámina del plan. */
  focoId: string | null;
  /** El `foco` vino en la forma heredada `l-NN`. */
  focoHeredado?: boolean;
  /** El `foco` es distinto del que se vio en la reconciliación anterior (o es la primera). */
  focoCambio: boolean;
  selectedId: string | null;
}): Reconciliacion {
  const n = ids.length;
  if (n === 0) return { posicion: null, seleccionar: null, escribirFoco: false };
  const posFoco = focoId ? ids.indexOf(focoId) + 1 : 0;
  const posSel = selectedId ? ids.indexOf(selectedId) + 1 : 0;

  if (focoCambio && posFoco > 0) {
    return { posicion: posFoco, seleccionar: focoId !== selectedId ? focoId : null, escribirFoco: focoHeredado };
  }
  if (posSel > 0) return { posicion: posSel, seleccionar: null, escribirFoco: focoHeredado || focoId !== selectedId };
  if (posFoco > 0) return { posicion: posFoco, seleccionar: focoId, escribirFoco: focoHeredado };
  return { posicion: 1, seleccionar: ids[0], escribirFoco: true };
}

/** La vecina que queda seleccionada al eliminar: la siguiente, o la anterior si era la última. */
export function vecinaAlEliminar(ids: readonly string[], id: string): string | null {
  const i = ids.indexOf(id);
  if (i < 0) return null;
  return ids[i + 1] ?? ids[i - 1] ?? null;
}
