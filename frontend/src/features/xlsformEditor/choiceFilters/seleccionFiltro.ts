// Qué filtro muestra el detalle de «Filtros de opciones»: el elegido por la dirección (`foco` = `name` de la
// pregunta) o, si no hay o ya no existe, el primero. Así el detalle nunca queda vacío mientras haya filtros.

import type { ChoiceFilterCard } from "./buildChoiceFilterModel";

export function filtroElegido(cards: readonly ChoiceFilterCard[], seleccionada: string | null): ChoiceFilterCard | null {
  if (cards.length === 0) return null;
  return cards.find((c) => c.questionCode === seleccionada) ?? cards[0];
}
