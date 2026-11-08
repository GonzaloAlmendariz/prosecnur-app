// «Confirmar los idénticos (N)» en «Revisar emparejado» (X6). Es el único lote: sólo las sugerencias cuyo texto es el
// mismo (coincidencia «Idéntico»), y cada par queda confirmado en la lámina igual que si se hubiera confirmado a mano,
// así que se deshace par por par con «Quitar de la lámina». Parecidos y distintos se siguen confirmando fila por fila.

import type { TemaPublicos } from "../../multiapiladas/temasPublicos";
import type { CoincidenciaDePar } from "./coincidencia";
import { formatoConteo } from "../../../../lib/formatoNumero";
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

/**
 * Las filas sugeridas que el lote deja sin su sugerencia (E6): las que no entran al lote y apuntan a una pregunta que el
 * lote confirma con otra. Tras confirmar, esas filas pasan a otra sugerencia o a «Sin par».
 */
export function sugerenciasQuePierdeElLote(filas: readonly FilaEmparejado[], lote: readonly FilaEmparejado[]): number {
  const enLote = new Set(lote.map((f) => f.clave));
  const tomadas = new Set(lote.flatMap((f) => (f.par ? [f.clave, refDe(f.par)] : [f.clave])));
  return filas.filter((f) => f.estado === "sugerido" && f.par && !enLote.has(f.clave) && !tomadas.has(f.clave) && tomadas.has(refDe(f.par))).length;
}

/** «8 filas perdieron su sugerencia: su par ya se confirmó.»; nada si ninguna la perdió. */
export function avisoSugerenciasPerdidas(n: number): string | null {
  if (n <= 0) return null;
  return n === 1
    ? "1 fila perdió su sugerencia: su par ya se confirmó."
    : `${formatoConteo(n)} filas perdieron su sugerencia: su par ya se confirmó.`;
}
