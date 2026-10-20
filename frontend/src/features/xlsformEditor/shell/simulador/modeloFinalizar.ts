// Finalizar y restricciones en «Probar formulario» (E8, 2026-10-20). La regla: no se finaliza la encuesta sin las
// obligatorias. «Siguiente» deja avanzar, pero la última sección muestra «Finalizar», que lista lo que falta con un
// enlace a cada pregunta. Las restricciones se evalúan con el mismo motor de «Probar la regla» (logic/probarRestriccion).

import type { BuilderNode } from "../../types";
import { evaluarRestriccion } from "../../logic/probarRestriccion";
import { esFilaRota } from "../../reglas/motor/filaRota";
import type { SimValue } from "./modeloRecorrido";

export const MENSAJE_REGLA_POR_DEFECTO = "Esta respuesta no cumple la regla de la pregunta.";

const tieneRespuesta = (v: SimValue | undefined) => (Array.isArray(v) ? v.length > 0 : !!v && v.trim() !== "");

/**
 * El mensaje de la regla si la respuesta dada la incumple; null si cumple, si no hay respuesta (lo vacío lo juzga
 * «obligatoria») o si el editor no sabe evaluarla (eso se comprueba en el teléfono, no se inventa un rechazo).
 */
export function restriccionIncumplida(
  node: Pick<BuilderNode, "name" | "constraint" | "constraint_message" | "relevant" | "calculation" | "choiceFilter">,
  valor: SimValue | undefined,
  respuestas: Readonly<Record<string, SimValue>>,
): string | null {
  if (!node.constraint.trim() || !tieneRespuesta(valor) || esFilaRota(node)) return null;
  const texto = Array.isArray(valor) ? valor.join(" ") : (valor ?? "");
  let r: ReturnType<typeof evaluarRestriccion>;
  try {
    r = evaluarRestriccion(node.constraint, texto, respuestas, node.name || undefined);
  } catch {
    return null;
  }
  if (r !== "rechaza") return null;
  return (node.constraint_message ?? "").trim() || MENSAJE_REGLA_POR_DEFECTO;
}

export type Pendiente = { name: string; rowIndex: number; numero: string; enunciado: string; pagina: number; motivo: "falta" | "regla" };

/** Lo que impide finalizar, en el orden del formulario: obligatorias visibles sin respuesta y reglas incumplidas. */
export function pendientesParaFinalizar(
  paginasVisibles: readonly { nodes: readonly BuilderNode[] }[],
  esRespondible: (n: BuilderNode) => boolean,
  esVisible: (n: BuilderNode) => boolean,
  respuestas: Readonly<Record<string, SimValue>>,
): Pendiente[] {
  const out: Pendiente[] = [];
  paginasVisibles.forEach((p, pagina) => {
    for (const n of p.nodes) {
      if (!esRespondible(n) || !esVisible(n)) continue;
      const v = respuestas[n.name];
      const motivo = n.required && !tieneRespuesta(v) ? "falta" : restriccionIncumplida(n, v, respuestas) ? "regla" : null;
      if (motivo) out.push({ name: n.name, rowIndex: n.rowIndex, numero: n.paperNumber || "", enunciado: n.label || n.name, pagina, motivo });
    }
  });
  return out;
}
