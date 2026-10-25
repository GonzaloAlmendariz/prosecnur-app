// TXT-10/16: qué pregunta muestra Codificar según el `foco` de la dirección. Un foco que no está en «Preguntas para
// codificar» no cae mudo en la primera: se avisa y, si Preparar lo permite, se ofrece incluirla (nunca sola).

import { arquetipoOf, type PreguntaAbierta } from "../../api/codificacion";

export type FocoCodificar =
  | { tipo: "activa"; parent: string }
  | { tipo: "sin-incluir"; pregunta: PreguntaAbierta; incluible: boolean }
  | { tipo: "no-existe"; foco: string }
  | { tipo: "ninguna" };

/** Las mismas que en Preparar muestran el interruptor «Incluir en codificación» (`MarcarFooter`). */
function esIncluible(p: PreguntaAbierta): boolean {
  if (p.marcada_auto) return false;
  const arq = arquetipoOf(p);
  return arq !== "no-aplica" && arq !== "config-so" && arq !== "adoptada";
}

export function resolverFocoCodificar(
  preguntas: readonly PreguntaAbierta[],
  marcadas: readonly PreguntaAbierta[],
  foco: string | null,
): FocoCodificar {
  if (foco) {
    if (marcadas.some((p) => p.parent === foco)) return { tipo: "activa", parent: foco };
    const marcadaPorColumna = marcadas.find((p) => p.col_efectiva === foco);
    if (marcadaPorColumna) return { tipo: "activa", parent: marcadaPorColumna.parent };
    const pregunta = preguntas.find((p) => p.parent === foco) ?? preguntas.find((p) => p.col_efectiva === foco);
    if (pregunta) return { tipo: "sin-incluir", pregunta, incluible: esIncluible(pregunta) };
    return { tipo: "no-existe", foco };
  }
  return marcadas[0] ? { tipo: "activa", parent: marcadas[0].parent } : { tipo: "ninguna" };
}
