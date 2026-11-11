// Cuántas respuestas de la lista ya tienen código. Numerador y denominador salen de la MISMA lista: las
// respuestas únicas que la base trae hoy. Un grupo puede guardar claves de textos que la base ya no trae
// (se actualizó la fuente, se limpió un caso); esas asignaciones se conservan, pero no cuentan como avance.

export type AvanceRespuestas = {
  /** Respuestas de la lista con al menos un código. */
  codificadas: number;
  /** Respuestas de la lista sin ningún código. */
  pendientes: number;
  /** Respuestas de la lista. Siempre `codificadas + pendientes`. */
  total: number;
  /** Claves con código que no están en la lista. */
  huerfanas: number;
};

export function avanceDeRespuestas(
  respuestas: readonly { texto_normalizado: string }[] | null | undefined,
  grupos: readonly { respuestas: readonly string[] }[],
): AvanceRespuestas {
  const asignadas = new Set<string>();
  for (const grupo of grupos) for (const clave of grupo.respuestas) asignadas.add(clave);

  const enLista = new Set<string>();
  for (const r of respuestas ?? []) enLista.add(r.texto_normalizado);

  let codificadas = 0;
  for (const clave of enLista) if (asignadas.has(clave)) codificadas += 1;

  let huerfanas = 0;
  for (const clave of asignadas) if (!enLista.has(clave)) huerfanas += 1;

  const total = enLista.size;
  return { codificadas, pendientes: total - codificadas, total, huerfanas };
}
