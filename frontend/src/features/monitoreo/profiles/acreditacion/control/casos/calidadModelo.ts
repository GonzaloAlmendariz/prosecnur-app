/**
 * Control › Calidad (ficha Ctl7): si hay respuestas sospechosas. Lee las
 * duraciones fuera de rango de `dashboard.inconsistencies` y las clasifica por
 * su valor frente a los umbrales del proyecto (`min_duration_seconds` y
 * `max_duration_seconds`): una muy larga no es «muy corta» aunque el tipo diga
 * otra cosa (H1). Las señales de consistencia son las alertas reales de la
 * hoja «Alertas», con el modelo de siempre (`AcreditacionPhoneAlerts`).
 */

import type { MonitoreoRow } from "../../../../../../api/client";

export type DuracionFueraDeRango = {
  id: string;
  segundos: number;
  tipo: "corta" | "larga";
  /** Fila del corte, para unirla con su caso. */
  fila?: number;
  /** Del caso de la bandeja: el ID de la respuesta, su público y su estado. */
  respuesta?: string;
  publico?: string;
  estado?: string;
};

function numero(valor: unknown): number | null {
  const n = Number(String(valor ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Número de fila, o null si no viene (`Number("")` daría 0). */
function filaDe(valor: unknown): number | null {
  if (valor == null || String(valor).trim() === "") return null;
  return numero(valor);
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
      const numeroDeFila = filaDe(fila.row);
      return { id: String(fila.id ?? fila.row ?? indice + 1), segundos, tipo, ...(numeroDeFila == null ? {} : { fila: numeroDeFila }) };
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

/**
 * Cada duración con su respuesta: sin variable de ID configurada, la hoja de
 * inconsistencias trae el número de fila del corte (2668), mientras Respuestas
 * y Por resolver muestran el ID de SurveyMonkey. Se unen por `response_row`.
 */
export function conSuRespuesta(
  duraciones: readonly DuracionFueraDeRango[],
  casos: ReadonlyArray<{ response_row?: unknown; response_id?: unknown; actor?: unknown; platform_state?: unknown }>,
): DuracionFueraDeRango[] {
  const porFila = new Map<number, (typeof casos)[number]>();
  for (const caso of casos) {
    const fila = filaDe(caso.response_row);
    if (fila != null && String(caso.response_id ?? "")) porFila.set(fila, caso);
  }
  return duraciones.map((item) => {
    const caso = item.fila == null ? undefined : porFila.get(item.fila);
    if (!caso) return item;
    return { ...item, respuesta: String(caso.response_id), publico: String(caso.actor ?? ""), estado: String(caso.platform_state ?? "") };
  });
}
