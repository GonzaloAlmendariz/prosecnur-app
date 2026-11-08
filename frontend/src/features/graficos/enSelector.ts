// Qué tipos ofrece un selector: los que el registro no saca con `en_selector = FALSE` (población antigua, FODA…) ni
// retira el ADR 0137 (en la fase 1 llegan con `en_selector` intacto: se quitan por nombre).
// Sólo filtra lo que se ofrece al insertar; un plan que ya usa un tipo retirado lo sigue resolviendo y dibujando.
import { TIPOS_RETIRADOS_0137 } from "./retirados";

export function enSelector<T extends { en_selector?: boolean; name?: string }>(items: readonly T[]): T[] {
  return items.filter((x) => x.en_selector !== false && !TIPOS_RETIRADOS_0137.has(x.name ?? ""));
}
