// Qué le pasa a los grupos de codificación cuando una respuesta recibe o pierde un código.
//
// Es la operación que usan las dos vistas de Codificar (tarjetas y tabla): `RespuestasCodificador`
// la llama al asignar desde el menú de una fila, y la tabla al pulsar Enter. Aquí no se decide
// CUÁNDO una respuesta admite varios códigos: eso lo sabe quien llama (`permiteVarios`), que lo
// calcula una sola vez a partir del tipo de la pregunta.

import type { Grupo } from "../../../api/codificacion";

/**
 * Lleva la respuesta `clave` al grupo `grupoId`.
 *
 * - Con `permiteVarios`, el código se suma a los que la respuesta ya tenía.
 * - Sin `permiteVarios`, la respuesta sale de cualquier otro grupo: queda con un solo código.
 *
 * Si `grupoId` no existe no se toca nada: se devuelve el mismo arreglo.
 */
export function asignarCodigo(
  grupos: readonly Grupo[],
  clave: string,
  grupoId: string,
  permiteVarios: boolean,
): Grupo[] {
  if (!grupos.some((g) => g.id === grupoId)) return grupos as Grupo[];
  return grupos.map((g) => {
    const esDestino = g.id === grupoId;
    if (permiteVarios) {
      if (!esDestino || g.respuestas.includes(clave)) return g;
      return { ...g, respuestas: [...g.respuestas, clave] };
    }
    const resto = g.respuestas.filter((r) => r !== clave);
    if (esDestino) return { ...g, respuestas: [...resto, clave] };
    return resto.length === g.respuestas.length ? g : { ...g, respuestas: resto };
  });
}

/** Quita la respuesta `clave` del grupo `grupoId` y deja los demás como estaban. */
export function quitarCodigo(grupos: readonly Grupo[], clave: string, grupoId: string): Grupo[] {
  return grupos.map((g) =>
    g.id === grupoId && g.respuestas.includes(clave)
      ? { ...g, respuestas: g.respuestas.filter((r) => r !== clave) }
      : g,
  );
}
