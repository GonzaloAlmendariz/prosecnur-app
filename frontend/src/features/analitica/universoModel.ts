// La línea «Cuentan 2,500 de 3,318 casos» de Analítica: qué decir por base
// según «Qué caso cuenta» de Validación. Sólo las bases que declaran un
// criterio; sin criterio cuentan todos y no hay nada nuevo que decir.

import type { UniversoDeBase } from "../../api/analitica";
import { formatoConteo, formatoConteoDe } from "../../lib/formatoNumero";
import { textoCondicion } from "../validacion/casoValidoManualModel";

export type LineaUniverso = { base: string; texto: string; aviso: boolean };

export function lineasUniverso(bases: readonly UniversoDeBase[]): LineaUniverso[] {
  const declaradas = bases.filter((b) => b.declarado);
  const varias = bases.length > 1;
  return declaradas.map((b) => {
    const enBase = varias ? ` en ${b.base}` : "";
    const criterio = b.condiciones.map((c) => textoCondicion(c)).join(" y ");
    if (!b.aplicado) {
      return {
        base: b.base,
        aviso: true,
        texto: `El criterio${enBase} (${criterio}) dejaría la base sin casos, así que cuentan todos (${formatoConteo(b.n_total)}).`,
      };
    }
    return {
      base: b.base,
      aviso: false,
      texto: `Cuentan ${formatoConteo(b.n_validos)} de ${formatoConteoDe(b.n_total, "caso")}${enBase}: ${criterio}.`,
    };
  });
}
