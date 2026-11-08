// «Confirmar los idénticos (N)» en «Revisar emparejado» (X6). Es el único lote: sólo las sugerencias cuyo texto es el
// mismo (coincidencia «Idéntico»), y cada par queda confirmado en la lámina igual que si se hubiera confirmado a mano,
// así que se deshace par por par con «Quitar de la lámina». Parecidos y distintos se siguen confirmando fila por fila.

import type { TemaPublicos } from "../../multiapiladas/temasPublicos";
import type { CoincidenciaDePar } from "./coincidencia";
import { confirmarPar, refDe, type FilaEmparejado } from "./modeloEmparejado";

/**
 * Las sugerencias idénticas que el lote confirma, en el orden de la tabla. Una pregunta entra una sola vez: la otra cara
 * de un par ya tomado (la fila de la segunda base que sugiere el mismo par) o una segunda fila que apunta a la misma
 * pregunta se quedan fuera, para que el lote no mueva un par que acaba de confirmar.
 */
export function identicosPorConfirmar(
  filas: readonly FilaEmparejado[],
  coincidencias: ReadonlyMap<string, CoincidenciaDePar | null>,
): FilaEmparejado[] {
  const tomadas = new Set<string>();
  const lote: FilaEmparejado[] = [];
  for (const f of filas) {
    if (f.estado !== "sugerido" || !f.par || coincidencias.get(f.clave)?.clase !== "identico") continue;
    const otra = refDe(f.par);
    if (tomadas.has(f.clave) || tomadas.has(otra)) continue;
    tomadas.add(f.clave);
    tomadas.add(otra);
    lote.push(f);
  }
  return lote;
}

/** Los temas de la lámina con todos los pares del lote confirmados (confirmarPar, uno tras otro). */
export function confirmarIdenticos(
  temas: readonly TemaPublicos[],
  bases: readonly string[],
  lote: readonly FilaEmparejado[],
): TemaPublicos[] {
  return lote.reduce<TemaPublicos[]>(
    (acc, f) => (f.par ? confirmarPar(acc, bases, f.pregunta, f.par, f.pregunta.tema) : acc),
    [...temas],
  );
}
