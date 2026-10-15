// Estado de cada lámina del Informe y su resumen clicable (I3 del rediseño, 2026-10-14). Puro: VistaGeneral junta las
// fuentes (validador del plan, avisos del motor de la última vista previa, colores pendientes) y aquí sólo se decide.
// Un aviso pesa más que unos colores pendientes, y éstos más que una ranura vacía: la pill dice lo más urgente.

import type { ValidationIssue } from "../usePlanValidator";

export type ClaveEstado = "lista" | "aviso" | "colores" | "vacia";
export type FiltroInforme = "todas" | Exclude<ClaveEstado, "lista">;
export type EstadoTarjeta = { clave: ClaveEstado; texto: string };
export type LaminaConRanuras = { id: string; ranuras: number; ranurasLlenas: number };

export const FILTROS_INFORME: readonly { clave: FiltroInforme; rotulo: string }[] = [
  { clave: "todas", rotulo: "Todas" },
  { clave: "aviso", rotulo: "Con avisos" },
  { clave: "colores", rotulo: "Faltan colores" },
  { clave: "vacia", rotulo: "Sin gráfico" },
];

export function estadosDeLaminas(
  laminas: readonly LaminaConRanuras[],
  issues: readonly Pick<ValidationIssue, "slideId" | "severity">[],
  avisosMotor: Readonly<Record<string, number>>,
  conColoresPendientes: ReadonlySet<string>,
): Map<string, EstadoTarjeta> {
  const avisos = new Map<string, number>();
  for (const i of issues) if (i.slideId) avisos.set(i.slideId, (avisos.get(i.slideId) ?? 0) + 1);
  const out = new Map<string, EstadoTarjeta>();
  for (const l of laminas) {
    const n = (avisos.get(l.id) ?? 0) + (avisosMotor[l.id] ?? 0);
    const vacias = l.ranuras - l.ranurasLlenas;
    out.set(l.id, n > 0
      ? { clave: "aviso", texto: n === 1 ? "1 aviso" : `${n} avisos` }
      : conColoresPendientes.has(l.id)
        ? { clave: "colores", texto: "Faltan colores" }
        : l.ranuras > 0 && vacias > 0
          ? { clave: "vacia", texto: vacias === l.ranuras ? "Sin gráfico" : `${vacias} sin gráfico` }
          : { clave: "lista", texto: "Lista" });
  }
  return out;
}

export function contarEstados(estados: ReadonlyMap<string, EstadoTarjeta>): Record<FiltroInforme, number> {
  const c: Record<FiltroInforme, number> = { todas: estados.size, aviso: 0, colores: 0, vacia: 0 };
  for (const e of estados.values()) if (e.clave !== "lista") c[e.clave] += 1;
  return c;
}

export const pasaFiltro = (filtro: FiltroInforme, estado: EstadoTarjeta | undefined) =>
  filtro === "todas" || estado?.clave === filtro;
