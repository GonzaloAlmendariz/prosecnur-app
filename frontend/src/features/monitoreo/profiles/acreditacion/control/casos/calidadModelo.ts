/**
 * Control › Calidad (ficha Ctl7): si hay respuestas sospechosas. Lee las
 * duraciones fuera de rango de `dashboard.inconsistencies` y las clasifica por
 * su valor frente a los umbrales del proyecto (`min_duration_seconds` y
 * `max_duration_seconds`): una muy larga no es «muy corta» aunque el tipo diga
 * otra cosa (H1). Las señales de consistencia son las alertas reales de la
 * hoja «Alertas», con el modelo de siempre (`AcreditacionPhoneAlerts`).
 */

import type { MonitoreoRow } from "../../../../../../api/client";

export type DuracionFueraDeRango = { id: string; segundos: number; tipo: "corta" | "larga" };

function numero(valor: unknown): number | null {
  const n = Number(String(valor ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function duracionesFueraDeRango(
  inconsistencias: readonly MonitoreoRow[],
  minimo: number,
  maximo: number,
): DuracionFueraDeRango[] {
  return inconsistencias
    .filter((fila) => String(fila.tipo ?? "").startsWith("duracion"))
    .map((fila, indice) => {
      const segundos = numero(fila.valor);
      if (segundos == null) return null;
      const tipo: DuracionFueraDeRango["tipo"] = segundos > maximo ? "larga" : segundos < minimo ? "corta" : String(fila.tipo).includes("larga") ? "larga" : "corta";
      return { id: String(fila.id ?? fila.row ?? indice + 1), segundos, tipo };
    })
    .filter((item): item is DuracionFueraDeRango => Boolean(item))
    .sort((a, b) => a.segundos - b.segundos);
}

/** «45 s», «12.5 min», «3.2 h» o «9.9 días». */
export function duracionLegible(segundos: number): string {
  const una = (n: number) => n.toLocaleString("es-PE", { maximumFractionDigits: 1 });
  if (segundos < 60) return `${una(segundos)} s`;
  if (segundos < 3600) return `${una(segundos / 60)} min`;
  if (segundos < 86400) return `${una(segundos / 3600)} h`;
  return `${una(segundos / 86400)} días`;
}
