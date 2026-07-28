import type { ActiveDesk } from "../sharedCore";

/**
 * F9 (bug QA #4): decide si un cambio de mesa amerita resetear la sección
 * activa del rail a su default. Reglas:
 *
 *  - Solo en cambio REAL de mesa (prev ≠ next). Antes el efecto corría también
 *    con los flips transitorios de `recoveredAulasDesk` (aulasState → null
 *    mientras un job refresca el estado) y devolvía la vista a la sección por
 *    defecto ("Datos") al terminar el job, sin que la mesa hubiera cambiado.
 *  - Nunca mientras una mesa recuperada está activa: el flujo de recovery fija
 *    su propia sección (classroomRecoveryTarget), el default la pisaría.
 *  - Nunca cuando la override sigue vigente y el flip transitorio la ocultó
 *    (deskOverride ≠ desk): la mesa elegida por el usuario no cambió.
 *  - Nunca cuando la dirección pide una sección que la mesa NUEVA sí tiene. El
 *    default existe para no dejar el rail apuntando a una sección inexistente;
 *    si la pedida existe, no hay nada que arreglar y pisarla rompería todo
 *    deep-link. Esto cubre el aterrizaje —donde la mesa pasa de `sin_definir` a
 *    la real al hidratar, un cambio que contaba como legítimo— sin necesidad de
 *    distinguir el primer render: un cambio de mesa a mano sigue reseteando,
 *    porque la sección de la mesa vieja no suele existir en la nueva.
 */
export function debeResetearRailSection(args: {
  prevDesk: ActiveDesk | null;
  desk: ActiveDesk;
  recoveredAulasDesk: ActiveDesk | null;
  deskOverride: ActiveDesk | null;
  /** La dirección nombra una sección que existe en la mesa vigente. */
  direccionPideSeccion?: boolean;
}): boolean {
  if (args.prevDesk === args.desk) return false;
  if (args.recoveredAulasDesk) return false;
  if (args.deskOverride && args.deskOverride !== args.desk) return false;
  if (args.direccionPideSeccion) return false;
  return true;
}
