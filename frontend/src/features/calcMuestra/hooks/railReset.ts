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
 */
export function debeResetearRailSection(args: {
  prevDesk: ActiveDesk | null;
  desk: ActiveDesk;
  recoveredAulasDesk: ActiveDesk | null;
  deskOverride: ActiveDesk | null;
}): boolean {
  if (args.prevDesk === args.desk) return false;
  if (args.recoveredAulasDesk) return false;
  if (args.deskOverride && args.deskOverride !== args.desk) return false;
  return true;
}
