import type { PlannerModos } from "../../../api/planner";
import { MONITOREO_MODOS, type MonitoreoModo, type MonitoreoModoDefinicion } from "./monitoreoRegistry";

/**
 * A qué modo entra Monitoreo según el Planner (ADR 0122, fase P2).
 *
 * El tipo de estudio ya no se elige en Monitoreo: lo fijan los perfiles de
 * recojo declarados en el Planner (`GET /api/planner/modos`). Nada se escribe
 * solo al abrir: si la config ya está en una familia que el Planner declara,
 * se abre; si el Planner declara una sola y la config no la tiene, se ofrece
 * un botón para alinearla; con varias, se eligen SÓLO entre las declaradas.
 *
 * Si el Planner no se puede leer, Monitoreo se comporta como antes (`respaldo`):
 * leer el Planner nunca puede impedir abrir el módulo.
 */
export type AterrizajeDeMonitoreo =
  | { tipo: "cargando" }
  | { tipo: "abrir" }
  | { tipo: "sin-perfil" }
  | { tipo: "alinear"; modo: MonitoreoModoDefinicion }
  | { tipo: "elegir"; modos: MonitoreoModoDefinicion[] }
  | { tipo: "respaldo" };

export function decidirAterrizajeDeMonitoreo(
  modos: PlannerModos | null,
  error: string | null,
  familiaElegida: MonitoreoModo | null,
): AterrizajeDeMonitoreo {
  if (!modos) return error ? { tipo: "respaldo" } : { tipo: "cargando" };
  const declarados = MONITOREO_MODOS.filter((m) => m.status === "active" && modos.monitoreo.familias.includes(m.family));
  if (!declarados.length) return modos.perfiles.length ? { tipo: "respaldo" } : { tipo: "sin-perfil" };
  if (familiaElegida && declarados.some((m) => m.family === familiaElegida)) return { tipo: "abrir" };
  if (declarados.length === 1) return { tipo: "alinear", modo: declarados[0] };
  return { tipo: "elegir", modos: declarados };
}
