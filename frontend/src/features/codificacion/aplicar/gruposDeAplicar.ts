// Codificación, Aplicar: la lista "Preguntas de la base codificada" agrupada como en el prototipo. Puro.
//
// El prototipo separa "Listas" de "No entran todavía" y supone que solo entran las preguntas completas.
// El motor aplica toda pregunta que puede aplicar (`bridge_soportado`), completa o a medias; las que no
// puede aplicar quedan fuera con su causa. Por eso la lista dice lo que de verdad pasa:
//   - "Listas": se aplican y todas sus respuestas tienen código;
//   - "En curso": se aplican, pero les faltan respuestas sin código ("Faltan N"), que entran sin código propio;
//   - "No entran todavía": las que el motor no puede aplicar (van con su causa en su bloque).
// Sin el avance de las preguntas (no se pudo leer) no se inventa: la lista va sin grupos.

import type { PlanPregunta } from "../../../api/dashboard";
import { formatoConteo } from "../../../lib/formatoNumero";

/** Respuestas (casos) con código y respuestas de la pregunta: la definición de toda la sección. */
export type AvanceParaAplicar = { decididas: number; total: number };

export type EstadoDeFila = { texto: string; tono: "listo" | "curso" };

export type GrupoDeAplicar = { id: "listas" | "en-curso"; rotulo: string; preguntas: PlanPregunta[] };

/** El estado de una pregunta que se aplica: "Lista" o "Faltan N" respuestas sin código. */
export function estadoDeFila(avance: AvanceParaAplicar | undefined): EstadoDeFila | null {
  if (!avance || avance.total <= 0) return null;
  const faltan = Math.max(0, avance.total - avance.decididas);
  return faltan === 0 ? { texto: "Lista", tono: "listo" } : { texto: `Faltan ${formatoConteo(faltan)}`, tono: "curso" };
}

/** Las preguntas que se aplican, en dos grupos; `null` si no se sabe el avance de alguna. */
export function gruposDeAplicar(
  aplicables: readonly PlanPregunta[],
  avances: ReadonlyMap<string, AvanceParaAplicar> | null,
): GrupoDeAplicar[] | null {
  if (!avances) return null;
  const estados = aplicables.map((p) => estadoDeFila(avances.get(p.parent)));
  if (estados.some((e) => e === null)) return null;
  const listas = aplicables.filter((_, i) => estados[i]?.tono === "listo");
  const enCurso = aplicables.filter((_, i) => estados[i]?.tono === "curso");
  const grupos: GrupoDeAplicar[] = [];
  if (listas.length) grupos.push({ id: "listas", rotulo: "Listas", preguntas: listas });
  if (enCurso.length) grupos.push({ id: "en-curso", rotulo: "En curso", preguntas: enCurso });
  return grupos;
}
