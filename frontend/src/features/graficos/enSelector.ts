// Qué tipos ofrece un selector: los que el registro no saca con `en_selector = FALSE` (población antigua, FODA…).
// Sólo filtra lo que se ofrece al insertar; un plan que ya usa un tipo retirado lo sigue resolviendo y dibujando.
export function enSelector<T extends { en_selector?: boolean }>(items: readonly T[]): T[] {
  return items.filter((x) => x.en_selector !== false);
}
