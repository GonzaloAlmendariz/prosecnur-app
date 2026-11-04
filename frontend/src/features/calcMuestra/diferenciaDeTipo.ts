import type { PlannerModos } from "../../api/planner";
import { ETIQUETA_PERFIL } from "../estudio/copiaDelEstudio";
import { decidirAterrizaje } from "./AterrizajeDelPlanner";
import type { ActiveDesk } from "./sharedCore";

/**
 * El tipo del estudio y el escenario guardado de Cálculo dicen cosas distintas
 * (auditoría visual del 4 nov 2026, hallazgo 11: `acnur_acg` es territorial y
 * Cálculo abría «Conglomerados en aulas»). Manda la Ficha del estudio (ADR 0123
 * y 0124), pero el escenario guardado no se sobrescribe en silencio: se nombran
 * las dos fuentes y se ofrece alinear, con la confirmación de lo que se pierde.
 *
 * `origen` dice si el tipo lo declaró la Ficha o se dedujo del estudio (la
 * Ficha todavía no lo declara). `null` si no hay diferencia, si no hay
 * escenario guardado o si el tipo no fija ningún modo de Cálculo.
 */
export type DiferenciaDeTipo = {
  desk: ActiveDesk;
  /** El modo que fija el tipo del estudio. */
  titulo: string;
  /** El modo del escenario guardado. */
  actual: string;
  /** El tipo del estudio, como lo nombra la Ficha. */
  tipo: string;
  origen: "declarado" | "deducido";
};

export function diferenciaDeTipo(
  modos: PlannerModos | null,
  currentDesk: ActiveDesk,
  hayEscenario: boolean,
): DiferenciaDeTipo | null {
  if (!modos || !hayEscenario || currentDesk === "sin_definir") return null;
  const decision = decidirAterrizaje(modos, currentDesk, hayEscenario);
  if (decision.tipo !== "cambiar") return null;
  const perfil = modos.calc.perfil;
  return {
    desk: decision.desk,
    titulo: decision.titulo,
    actual: decision.actual,
    tipo: perfil ? ETIQUETA_PERFIL[perfil] : decision.titulo,
    origen: modos.origen,
  };
}
