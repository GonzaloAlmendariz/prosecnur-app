/**
 * El salto de una sección en Hallazgos (ítem 42 del checklist de Validación
 * usada por un practicante). Cuando la condición de una sección no se cumple y
 * la encuesta igual trae respuestas en ella, el motor marca la encuesta una
 * vez por sección (`validacion_salto_seccion.R`), no una vez por pregunta.
 *
 * El motor lo dice en el subtipo del enunciado de cada caso
 * (`seccion_nodebe`) y en su `hecho`: "respondió 18 de las 20 preguntas de la
 * sección "Familia"". Aquí se lee eso para armar la tabla: la respuesta que
 * abre la sección y cuántas preguntas respondió.
 */
import type { EnunciadoEsperado } from "../../../api/validacionAuditoria";

export const SUBTIPO_SECCION = "seccion_nodebe";
/** La columna de cuántas preguntas de la sección respondió cada caso. */
export const CLAVE_RESPONDIDAS_DE_SECCION = "seccion:respondidas";

/** Si los casos del detalle son de una regla de sección. */
export function esReglaDeSeccion(esperado: ReadonlyArray<EnunciadoEsperado | null>): boolean {
  return esperado.some((e) => e?.subtipo === SUBTIPO_SECCION);
}

export type LecturaDeSeccion = { n: number; k: number; seccion: string };

/**
 * El `hecho` de un caso de sección: `respondió 18 de las 20 preguntas de la
 * sección "Familia"`, `respondió las 20 preguntas de …` o `respondió la
 * pregunta de …`. Otro enunciado: `null`.
 */
export function lecturaDeSeccion(hecho: string | null | undefined): LecturaDeSeccion | null {
  const h = hecho?.trim() ?? "";
  let m = /^respondió (\d+) de las (\d+) preguntas de la sección "(.+)"$/.exec(h);
  if (m) return { n: Number(m[1]), k: Number(m[2]), seccion: m[3] };
  m = /^respondió las (\d+) preguntas de la sección "(.+)"$/.exec(h);
  if (m) return { n: Number(m[1]), k: Number(m[1]), seccion: m[2] };
  m = /^respondió la pregunta de la sección "(.+)"$/.exec(h);
  if (m) return { n: 1, k: 1, seccion: m[1] };
  return null;
}

/** Lo que va en la celda: "18 de 20" o, si respondió todas, "Las 20". */
export function rotuloDeRespondidas(l: LecturaDeSeccion): string {
  if (l.n === l.k) return l.k === 1 ? "La única" : `Las ${l.k}`;
  return `${l.n} de ${l.k}`;
}
