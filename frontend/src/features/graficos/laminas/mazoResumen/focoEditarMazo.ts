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

/**
 * R6-11: al abrir el lateral la columna de tarjetas se angosta y la grilla se reacomoda; a 1024 px la tarjeta en edición
 * quedaba fuera de la vista. En el cuadro siguiente (con el lateral ya montado) se trae la tarjeta `aria-current` a la
 * vista, lo justo (`nearest`): si ya se ve, no se mueve nada.
 */
export function revelarEnEdicion(raiz: () => ParentNode | null, programar: (f: () => void) => void = requestAnimationFrame): void {
  programar(() => {
    const tarjeta = raiz()?.querySelector<HTMLElement>('[aria-current="true"]');
    if (tarjeta && typeof tarjeta.scrollIntoView === "function") tarjeta.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}
