// =============================================================================
// templates/index.ts — barrel + registry de templates seed disponibles
// =============================================================================
// Punto único de acceso al catálogo de plantillas. Cualquier consumidor
// (galería, settings reset, tests) usa este registry para evitar imports
// dispersos y mantener el orden estable.
//
// El orden del array `TEMPLATES` es el que verá el usuario en la galería:
// del más simple al más rico (blank → household → service-quality → census).
// =============================================================================

import { blankSeed } from "./seeds/blank";
import { householdSeed } from "./seeds/household";
import { serviceQualitySeed } from "./seeds/serviceQuality";
import { censusSeed } from "./seeds/census";
import type { TemplateSeed, TemplateId } from "./seedHelper";

export type { TemplateSeed, TemplateId } from "./seedHelper";
export { buildWorkbookFromSeed } from "./seedHelper";

export const TEMPLATES: TemplateSeed[] = [
  blankSeed,
  householdSeed,
  serviceQualitySeed,
  censusSeed,
];

/** Búsqueda por id (raro, útil para deep-links). */
export function findTemplate(id: TemplateId): TemplateSeed | null {
  return TEMPLATES.find((seed) => seed.id === id) ?? null;
}
