// Entrada del bloque «Experimento de elección por pares» (conjoint) en el menú «Añadir pieza» (E7c editor-conjoint, 2026-11-06). No inserta
// una fila: lleva a la pestaña Experimentos, que arma el diseño y lo inserta (C8, 2026-11-07).

import { FlaskConical } from "../../../vendor/lucide-react";
import type { AddMenuItem } from "../types";

export const CLAVE_ALTA_CONJOINT = "conjoint";

export function itemAltaConjoint(abrirPanel: () => void): AddMenuItem {
  return {
    key: CLAVE_ALTA_CONJOINT,
    label: "Experimento de elección por pares",
    hint: "Pares de perfiles con atributos sorteados y una pregunta de elección por par.",
    icon: <FlaskConical size={16} />,
    action: abrirPanel,
    group: "logic",
  };
}
