// Interruptor de las láminas de «Otros» en la barra de Vista general (contrato A5 2b; decisión 21 de Gonzalo: feature
// visible, apagada por defecto). Textos y reglas puros, aparte del componente.

import type { ModoMultibase } from "../modoMultibase";

export const ROTULO_OTROS = "Láminas de «Otros» en el PowerPoint";
export const CHIP_OTROS = "+ Otros al exportar";

/** Ayuda del interruptor: qué hace, dónde no aplica y, con un informe por base, a quién afecta. */
export function ayudaOtros(modo: Pick<ModoMultibase, "clave" | "visible">): string {
  const base = "Agrega, después de cada gráfico cuya pregunta tenga campo abierto, una lámina con las respuestas «Otros». " +
    "Sólo en el PowerPoint: el Word no las lleva.";
  return modo.visible && modo.clave === "por-base" ? `${base} Vale para la base activa.` : base;
}
