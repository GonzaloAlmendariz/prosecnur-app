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

/**
 * La ventana de campo que PROPONE el Planner frente al inicio de campo de
 * Monitoreo (decisión de Meta B, 2026-11-01: el Planner propone, Monitoreo se
 * alinea con un clic). Monitoreo sólo guarda el inicio de cada fase, así que se
 * compara el inicio; el piloto se conserva tal cual al alinear. Los inicios de
 * Monitoreo los pone Monitoreo: el Planner va primero y no los lee (ADR 0123 §5).
 */
export type DiscrepanciaDeVentana = { inicio: string; pilotoDesde: string; texto: string } | null;

function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])}/${m[2]}` : iso;
}

export function discrepanciaDeVentana(
  cal: PlannerCalendario | null,
  monitoreo: { pilotoDesde: string; campoDesde: string },
): DiscrepanciaDeVentana {
  if (!cal || cal.ventana.origen !== "declarado" || !cal.ventana.inicio) return null;
  const actual = monitoreo.campoDesde.slice(0, 10);
  if (actual === cal.ventana.inicio) return null;
  return {
    inicio: cal.ventana.inicio,
    pilotoDesde: monitoreo.pilotoDesde,
    texto: actual
      ? `El Planner propone campo desde el ${fechaCorta(cal.ventana.inicio)}; Monitoreo lo cuenta desde el ${fechaCorta(actual)}.`
      : `El Planner propone campo desde el ${fechaCorta(cal.ventana.inicio)}; Monitoreo no tiene inicio de campo.`,
  };
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
