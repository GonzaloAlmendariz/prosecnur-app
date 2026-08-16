// =============================================================================
// impactoDecisiones — qué van a hacer tus decisiones, antes de cerrar la base
// =============================================================================
// Vara V3 del GOAL de UI: una operación que no hace nada se ve antes de
// hacerla, no después.
//
// El motor simula cada vez que se guarda una decisión y devuelve el antes/
// después completo: filas de la base, inconsistencias, casos excluidos, celdas
// corregidas. Ese payload llegaba a la pestaña y no se usaba en ninguna parte.
//
// El caso que duele no es el de siempre —dos casos excluidos, catorce celdas—
// sino el otro: **decisiones marcadas listas cuyo impacto es cero**. Un valor
// mal escrito, un id de caso que no existe, un reemplazo que ya estaba
// aplicado. Hoy eso se descubre después de cerrar la base, y para entonces ya
// se invalidó codificación y analítica para rehacerlas idénticas.
// =============================================================================

import type { LimpiezaBeforeAfterPreview, LimpiezaDecisionSummary } from "./types";

export type ImpactoDecisiones = {
  /** Hay decisiones listas y ninguna cambia nada. Es el aviso que importa. */
  nulo: boolean;
  /**
   * Se declararon exclusiones y la base no perdió una sola fila. Medido sobre
   * `acrconta`: excluir un identificador que no existe reporta
   * `cases_excluded: 1` con `filas_base` en 172 → 172. El contador cuenta lo
   * que el analista escribió, no lo que el motor pudo sacar, así que confiar
   * en él dejaría pasar justo el error que esta banda busca.
   */
  exclusionSinEfecto: boolean;
  casosExcluidos: number;
  celdasCorregidas: number;
  reglasResueltas: number;
  filasAntes: number | null;
  filasDespues: number | null;
  /** Cuántas decisiones están marcadas listas: el denominador del aviso. */
  listas: number;
  /** Frase principal, ya en singular o plural. */
  titular: string;
};

function entero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

function conteoOpcional(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

/**
 * El impacto de lo que hay declarado, o `null` cuando no hay nada que declarar
 * —ninguna decisión lista—. Sin decisiones no hay superficie: el vacío de esta
 * banda es «todavía no decidiste», y eso ya lo dice la cola de hallazgos.
 */
export function calcularImpacto(
  preview: LimpiezaBeforeAfterPreview | null | undefined,
  summary: LimpiezaDecisionSummary | null | undefined,
): ImpactoDecisiones | null {
  const listas = entero(summary?.decisiones_listas ?? preview?.decisions_ready);
  if (listas <= 0) return null;

  const impacto = preview?.impact;
  const casosExcluidos = entero(impacto?.cases_excluded);
  const celdasCorregidas = entero(impacto?.cells_changed);
  const reglasResueltas = entero(impacto?.rules_resolved);
  const filasAntes = conteoOpcional(preview?.before?.filas_base);
  const filasDespues = conteoOpcional(preview?.after?.filas_base);

  // La verdad es el delta de filas, no el contador de exclusiones declaradas.
  const filasIguales = filasAntes !== null && filasDespues !== null && filasAntes === filasDespues;
  const exclusionSinEfecto = casosExcluidos > 0 && filasIguales;
  const nulo = celdasCorregidas === 0 && (exclusionSinEfecto || casosExcluidos === 0);

  const partes: string[] = [];
  if (casosExcluidos > 0 && !exclusionSinEfecto) {
    partes.push(plural(casosExcluidos, "caso excluido", "casos excluidos"));
  }
  if (celdasCorregidas > 0) partes.push(plural(celdasCorregidas, "celda corregida", "celdas corregidas"));

  const titular = exclusionSinEfecto
    ? `${plural(casosExcluidos, "exclusión declarada", "exclusiones declaradas")} y la base no pierde ninguna fila`
    : nulo
      ? `${plural(listas, "decisión lista", "decisiones listas")} y ninguna cambia la base`
      : partes.join(" · ");

  return {
    nulo,
    exclusionSinEfecto,
    casosExcluidos,
    celdasCorregidas,
    reglasResueltas,
    filasAntes,
    filasDespues,
    listas,
    titular,
  };
}

/**
 * El detalle de filas, sólo cuando la base efectivamente cambia de tamaño.
 * Repetir «103 → 103» es ruido: no dice nada que el titular no diga mejor.
 */
export function detalleFilas(impacto: ImpactoDecisiones): string {
  const { filasAntes, filasDespues } = impacto;
  if (filasAntes === null || filasDespues === null) return "";
  if (filasAntes === filasDespues) return "";
  return `La base pasaría de ${filasAntes} a ${filasDespues} casos al cerrar.`;
}
