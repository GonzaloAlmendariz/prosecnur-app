// Alcance de la pestaña «Estilo del informe» (decisión 28). A diferencia de «Estilo del cliente», se usa también en el
// informe compartido: el texto de la base, los cálculos, las paletas y la línea visual cambian el PPT consolidado. Lo
// que se edita ahí se guarda en el borrador del compartido y no se copia a ninguna base (ADR 0040 §6.1).
//
// Lo único que no aplica en el compartido es el bloque del Word: ese informe todavía no sale en Word
// (`GraficosPage.onExport`), así que su opción se muestra deshabilitada con el motivo.

import type { GraficosReportScope } from "../reportScope";

export const AMBITO_BASE_ACTIVA = "Estos ajustes valen para el PPT y el Word de esta base.";
/** Una base o un informe conjunto de varias (G15/U6, 2026-10-13: el conjunto de Arte decía «de esta base»). */
export const AMBITO_INFORME = "Estos ajustes valen para el PPT y el Word de este informe.";
export const AMBITO_COMPARTIDO =
  "Estás en el informe compartido: estos ajustes cambian su PPT consolidado y no se copian a ninguna base.";
export const MOTIVO_WORD_EN_COMPARTIDO =
  "El informe compartido todavía no sale en Word: esta opción se ajusta desde cada base.";

export type DisponibilidadInforme = {
  /** La pestaña se ofrece siempre: nunca se deshabilita en el rail. */
  disponible: true;
  ambito: string;
  /** Motivo por el que la opción del Word no se puede cambiar aquí, o `null` si se puede. */
  motivoWord: string | null;
};

export function disponibilidadInforme(scope: GraficosReportScope, unInformePorBase = false): DisponibilidadInforme {
  const compartido = scope === "consolidated";
  return {
    disponible: true,
    // «De esta base» sólo cuando cada base tiene su propio informe (hermanas independientes).
    ambito: compartido ? AMBITO_COMPARTIDO : unInformePorBase ? AMBITO_BASE_ACTIVA : AMBITO_INFORME,
    motivoWord: compartido ? MOTIVO_WORD_EN_COMPARTIDO : null,
  };
}
