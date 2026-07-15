// =============================================================================
// shell/homeSlots.ts — cómputo de slots del "Espacio de formularios"
// =============================================================================
// Lógica pura del hub: a partir del número de formularios existentes decide si
// se puede crear otro (tope MAX_FORMS), si estamos en el límite y cuántos slots
// fantasma pintar para insinuar la capacidad total sin ser ruidoso.
//
// Extraído del .tsx para poder testearlo sin montar React (rule 6).
// =============================================================================

import { MAX_FORMS } from "../state/persistence";

export type HomeSlots = {
  /** Formularios existentes (clamp a [0, MAX_FORMS]). */
  count: number;
  /** No hay ningún formulario todavía → la tarjeta de creación es protagonista. */
  empty: boolean;
  /** Se alcanzó el tope: sin tarjeta de creación, con nota sutil. */
  atLimit: boolean;
  /** Aún hay cupo para un formulario más. */
  canCreate: boolean;
  /** Slots fantasma restantes tras formularios + tarjeta de creación. */
  ghostSlots: number;
};

/** Deriva el estado de slots del hub para `count` formularios existentes. */
export function computeHomeSlots(count: number, max: number = MAX_FORMS): HomeSlots {
  const safeMax = Math.max(1, Math.floor(max));
  const clamped = Math.max(0, Math.min(Math.floor(count), safeMax));
  const canCreate = clamped < safeMax;
  // El slot de creación (hero o tile) ya ocupa uno cuando hay cupo; el resto
  // hasta safeMax son fantasmas.
  const usedSlots = clamped + (canCreate ? 1 : 0);
  return {
    count: clamped,
    empty: clamped === 0,
    atLimit: !canCreate,
    canCreate,
    ghostSlots: Math.max(0, safeMax - usedSlots),
  };
}
