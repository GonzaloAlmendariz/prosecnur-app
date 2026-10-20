// resumenDelInicio.ts — la tarjeta de Material de campo en el inicio del
// proyecto, resumida por campaña (ADR 0111 §9).
//
// Cuando el backend manda `facts["material-campo"].campaigns`, la tarjeta deja
// de hablar de un único plan de aulas: lista sus campañas con su avance. Un
// correo dice qué envío ya salió («Invitación exportada 20/10 · Recordatorio 1
// pendiente», decisión de Gonzalo); la de aulas, cuántos titulares tienen
// enlace. Las archivadas no cuentan.

import type { CampanaMaterial } from "../../../api/materialCampanas";
import { campanasVisibles, cuentaDeCampanas, lineaDeEnvios, resumenDeTarjeta } from "./modeloRegistro";

export type ResumenDelInicio = {
  estado: "pending" | "active" | "ready" | "warning";
  statusLabel: string;
  viz:
    | { kind: "progress"; current: number; total: number; display: string; label: string }
    | { kind: "stat"; value: string; label: string };
  sub: string;
  facts: { label: string; value: string }[];
};

const MAX_HECHOS = 3;

function avanceDe(c: CampanaMaterial): string {
  if (c.estado?.tipo === "correo") return lineaDeEnvios(c.estado) ?? resumenDeTarjeta(c).estado;
  return resumenDeTarjeta(c).estado;
}

/** `null` cuando no hay campañas que resumir: la tarjeta sigue como antes. */
export function resumenDelInicio(campanas: readonly CampanaMaterial[] | undefined): ResumenDelInicio | null {
  if (!campanas) return null;
  const visibles = campanasVisibles({ campaigns: [...campanas] });
  if (!visibles.length) return null;
  const resumenes = visibles.map((c) => ({ c, r: resumenDeTarjeta(c) }));
  const aulas = resumenes.find(({ c, r }) => c.tipo === "aulas" && r.avance && r.avance.total > 0);
  const avisa = resumenes.some(({ r }) => r.tono === "aviso");
  const listas = resumenes.every(({ r }) => r.tono === "listo");
  const correos = visibles.filter((c) => c.tipo === "correo").length;
  const deAulas = visibles.some((c) => c.tipo === "aulas");
  const partes = [
    ...(deAulas ? ["campo en aulas"] : []),
    ...(correos ? [`${correos} ${correos === 1 ? "correo" : "correos"}`] : []),
  ];
  return {
    estado: avisa ? "warning" : listas ? "ready" : "active",
    statusLabel: avisa ? "Requiere atención" : listas ? "Campañas listas" : "En preparación",
    viz: aulas?.r.avance
      ? {
        kind: "progress",
        current: aulas.r.avance.actual,
        total: aulas.r.avance.total,
        display: `${aulas.r.avance.actual}/${aulas.r.avance.total}`,
        label: aulas.r.avance.rotulo,
      }
      : { kind: "stat", value: String(visibles.length), label: visibles.length === 1 ? "campaña" : "campañas" },
    sub: `${cuentaDeCampanas(visibles.length)}: ${partes.join(" y ")}`,
    facts: visibles.slice(0, MAX_HECHOS).map((c) => ({ label: c.name, value: avanceDe(c) })),
  };
}
