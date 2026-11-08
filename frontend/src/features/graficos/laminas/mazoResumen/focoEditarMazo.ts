// M7: al cerrar la Regla del lateral (la X, Escape o el mismo «Editar»), el foco vuelve al «Editar» de su tarjeta: el
// lateral se desmonta con el foco dentro y, sin esto, caía al cuerpo del diálogo. Se busca por el id de la propuesta
// (`data-editar-mazo`) dentro de la columna de tarjetas.

/** El «Editar» de la propuesta `id` dentro de `raiz`; `null` si ya no está (la propuesta salió con otro juego de públicos). */
export function botonEditarDe(raiz: ParentNode | null, id: string): HTMLElement | null {
  if (!raiz) return null;
  return Array.from(raiz.querySelectorAll<HTMLElement>("[data-editar-mazo]")).find((b) => b.dataset.editarMazo === id) ?? null;
}

/** Devuelve el foco al «Editar» de la propuesta en el cuadro siguiente (cuando el lateral ya se desmontó). */
export function volverAlEditar(raiz: () => ParentNode | null, id: string, programar: (f: () => void) => void = requestAnimationFrame): void {
  programar(() => botonEditarDe(raiz(), id)?.focus());
}
