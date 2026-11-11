// Escenarios de la propuesta (PPT y Excel desde Cálculo de muestra): qué actores entran y la meta de cada uno en
// cada escenario. Puro: se prueba sin React ni red.
import type { CalcMuestraComponente, CalcMuestraPropuestaPayload } from "../../../api/calcMuestra";
import { metaCuotaFijada, sugerenciaCuota } from "../criterioSalida";
import { safeNumber } from "../sharedCore";

const CUANTITATIVOS = new Set(["estudiantes", "docentes", "administrativos", "egresados"]);

export type FilaPropuesta = { id: string; actor: string; poblacion: number };

/** Actores que entran en la propuesta: los cuantitativos con N declarado, en el orden del estudio. */
export function actoresDePropuesta(componentes: readonly CalcMuestraComponente[]): FilaPropuesta[] {
  return componentes
    .filter((c) => safeNumber(c.marco?.marco_validado, 0) > 0 && CUANTITATIVOS.has(c.actor_categoria))
    .map((c) => ({ id: c.id, actor: c.actor?.trim() || c.actor_id || c.id, poblacion: safeNumber(c.marco?.marco_validado, 0) }));
}

/**
 * Metas de partida: la A es la meta fijada del actor (o la que calculó el motor); la B, dos tercios de la A, como
 * en las propuestas anteriores. Son puntos de partida editables, no decisiones.
 */
export function escenariosIniciales(componentes: readonly CalcMuestraComponente[]): { A: Record<string, number>; B: Record<string, number> } {
  const A: Record<string, number> = {};
  const B: Record<string, number> = {};
  for (const c of componentes) {
    if (!(safeNumber(c.marco?.marco_validado, 0) > 0) || !CUANTITATIVOS.has(c.actor_categoria)) continue;
    const a = metaCuotaFijada(c) ?? sugerenciaCuota(c) ?? 0;
    A[c.id] = a;
    B[c.id] = Math.round((a * 2) / 3);
  }
  return { A, B };
}

export function totalEscenario(metas: Record<string, number>, filas: readonly FilaPropuesta[]): number {
  return filas.reduce((suma, f) => suma + (metas[f.id] ?? 0), 0);
}

export function payloadPropuesta(
  formato: "pptx" | "xlsx",
  metas: { A: Record<string, number>; B: Record<string, number> },
  filas: readonly FilaPropuesta[],
  opciones: { portada: boolean; diseno: boolean; solicitante: string },
): CalcMuestraPropuestaPayload {
  const solo = (m: Record<string, number>) => Object.fromEntries(filas.map((f) => [f.id, Math.max(0, Math.round(m[f.id] ?? 0))]));
  const solicitante = opciones.solicitante.trim();
  return {
    formato,
    escenarios: [
      { nombre: "Propuesta A", metas: solo(metas.A) },
      { nombre: "Propuesta B", metas: solo(metas.B) },
    ],
    incluir_portada: opciones.portada,
    incluir_diseno: opciones.diseno,
    ...(solicitante ? { solicitante: solicitante.startsWith("Solicitante") ? solicitante : `Solicitante: ${solicitante}` } : {}),
  };
}
