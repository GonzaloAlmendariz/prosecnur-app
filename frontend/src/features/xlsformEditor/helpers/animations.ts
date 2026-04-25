// =============================================================================
// helpers/animations.ts — duraciones y easings centralizados
// =============================================================================
// Constantes de animación que se reusan en todo el editor (drag-drop, expand/
// collapse, hovers, toasts). Todo vive como CSS transitions o keyframes en
// `app/theme.css`; este archivo solo expone los valores numéricos para usarlos
// en código TS (ej. setTimeout que coincide con la duración de una animación).
// =============================================================================

/** Duraciones (ms). */
export const DURATION = {
  /** Microinteractions (hover state, foco). */
  micro: 120,
  /** Transiciones de UI estándar (selección, expand/collapse). */
  base: 200,
  /** Animaciones más visibles (drop, slide-in de toast). */
  feature: 280,
  /** Toast auto-dismiss. */
  toast: 3000,
} as const;

/** Easings cubic-bezier reutilizables (string CSS-ready). */
export const EASING = {
  /** Salida estándar (Material standard). */
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  /** Entrada acelerada (entra rápido, frena al final). */
  decel: "cubic-bezier(0, 0, 0.2, 1)",
  /** Salida acelerada (frena rápido, sale lento). */
  accel: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

/** Stagger delay (ms) para animaciones encadenadas (ej. outline al cargar). */
export const STAGGER_DELAY_MS = 12;
