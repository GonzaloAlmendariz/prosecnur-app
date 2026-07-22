// =============================================================================
// shell/homeSlots.ts — cómputo de slots del "Espacio de formularios"
// =============================================================================
// Lógica pura del hub: a partir del número de formularios existentes decide si
// se puede crear otro (tope MAX_FORMS) y si estamos en el límite. La capacidad
// se comunica con texto; no se reservan tarjetas vacías en la grilla.
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
  /** Compatibilidad de shape: la interfaz ya no dibuja slots fantasma. */
  ghostSlots: number;
};

/** Deriva el estado de slots del hub para `count` formularios existentes. */
export function computeHomeSlots(count: number, max: number = MAX_FORMS): HomeSlots {
  const safeMax = Math.max(1, Math.floor(max));
  const clamped = Math.max(0, Math.min(Math.floor(count), safeMax));
  const canCreate = clamped < safeMax;
  return {
    count: clamped,
    empty: clamped === 0,
    atLimit: !canCreate,
    canCreate,
    ghostSlots: 0,
  };
}
