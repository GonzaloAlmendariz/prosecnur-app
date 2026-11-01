import { useEffect, useState } from "react";

import type { MonitoreoTerritorialPhase } from "../../../../../api/client";
import { apiPlannerCalendario, type PlannerCalendario } from "../../../../../api/planner";

/**
 * La etapa piloto/campo que DECLARA el Planner frente a la fase de Monitoreo
 * territorial (2i; decisión de Meta B, 2026-10-31). El Planner no escribe en
 * Monitoreo: si discrepan, se dice y se ofrece «Alinear la fase» con un clic,
 * por el endpoint de cambio de fase de siempre. Nada cambia sin ese clic. La
 * ventana de campo no se toca (decisión pendiente de Gonzalo).
 */

const FASE_DE_ETAPA: Record<string, MonitoreoTerritorialPhase> = { piloto: "pilot", campo: "field" };
const ETAPA_DE_FASE: Record<MonitoreoTerritorialPhase, string> = { pilot: "piloto", field: "campo" };

export type DiscrepanciaDeEtapa = { fase: MonitoreoTerritorialPhase; texto: string } | null;

/** Sólo cuando el Planner DECLARA la etapa (no la proyecta) y no coincide. */
export function discrepanciaDeEtapa(cal: PlannerCalendario | null, activa: MonitoreoTerritorialPhase | undefined): DiscrepanciaDeEtapa {
  if (!cal || cal.etapa.origen !== "declarado" || !cal.etapa.valor || !activa) return null;
  const fase = FASE_DE_ETAPA[cal.etapa.valor];
  if (!fase || fase === activa) return null;
  return { fase, texto: `El Planner dice ${cal.etapa.valor}; Monitoreo sigue en ${ETAPA_DE_FASE[activa]}.` };
}

export function usePlannerCalendario(): PlannerCalendario | null {
  const [cal, setCal] = useState<PlannerCalendario | null>(null);
  useEffect(() => {
    let vivo = true;
    apiPlannerCalendario().then((c) => { if (vivo) setCal(c); }).catch(() => { if (vivo) setCal(null); });
    return () => { vivo = false; };
  }, []);
  return cal;
}
