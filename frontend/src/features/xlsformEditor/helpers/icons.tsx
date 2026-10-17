// =============================================================================
// helpers/icons.ts — icono por tipo XLSForm
// =============================================================================
// Desde M8 (2026-10-17) el ícono de cada tipo sale del catálogo único del kit (`kit/tiposPregunta.ts`): un solo
// juego de íconos en todo el editor. Este helper queda como fachada para quien ya lo importaba.
// =============================================================================

import type { LucideIcon } from "../../../vendor/lucide-react";
import { tipoPregunta } from "../kit/tiposPregunta";

/** Devuelve el componente de icono para un tipo base. Fallback: ícono de ayuda. */
export function iconForType(baseType: string): LucideIcon {
  return tipoPregunta(baseType).icono;
}
