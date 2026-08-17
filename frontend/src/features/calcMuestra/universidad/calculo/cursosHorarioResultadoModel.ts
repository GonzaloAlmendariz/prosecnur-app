import type {
  CalcMuestraAulasEstrato,
  CalcMuestraResultado,
} from "../../../../api/client";

export type CursosHorarioResultado = {
  filas: CalcMuestraAulasEstrato[];
  aulasBaseTotal: number;
  aulasExtraTotal: number;
  aulasTotal: number;
  decision: NonNullable<CalcMuestraResultado["alumnos_por_ch_decision"]>;
};

function enteroNoNegativo(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function filaAcreditada(
  fila: CalcMuestraAulasEstrato,
  frameHash: string,
): boolean {
  const audit = fila.alumnos_por_ch;
  return Boolean(
    fila.estrato.trim() &&
    enteroNoNegativo(fila.aulas_base) &&
    enteroNoNegativo(fila.aulas_reemplazo) &&
    enteroNoNegativo(fila.aulas_total) &&
    audit?.referencia === "marco_ejecutado" &&
    audit.frame_hash === frameHash &&
    audit.denominador === "elegible" &&
    // Con la decisión sin firmar, R publica `estado: "sin_decision"` y
    // `referencia: "promedio_global"` SIN faculty_key ni valor: la fila se
    // calculó con el promedio global y no está acreditada por facultad. El
    // guard de arriba ya la descarta; estos campos son opcionales por eso.
    Boolean(audit.faculty_key?.trim()) &&
    audit.estadistico === fila.estadistico_usado &&
    Number.isFinite(audit.valor) && (audit.valor ?? 0) > 0 &&
    audit.valor === fila.avg_conglomerado
  );
}

/** Proyecta únicamente cifras y auditoría ya publicadas por R. */
export function cursosHorarioDesdeResultado(
  resultado: CalcMuestraResultado | null | undefined,
): CursosHorarioResultado | null {
  const decision = resultado?.alumnos_por_ch_decision;
  const filas = resultado?.aulas_por_estrato;
  if (
    !decision || decision.schema !== "calc_muestra_alumnos_por_ch_decision_v1" ||
    !decision.frame_hash.trim() || decision.denominador !== "elegible" ||
    !decision.confirmado_at.trim() || !filas?.length ||
    !enteroNoNegativo(resultado.aulas_base_total) ||
    !enteroNoNegativo(resultado.aulas_extra_total) ||
    !enteroNoNegativo(resultado.aulas_total) ||
    filas.some((fila) => !filaAcreditada(fila, decision.frame_hash)) ||
    new Set(filas.map((fila) => fila.estrato)).size !== filas.length
  ) return null;
  let rowBaseTotal = 0;
  let rowExtraTotal = 0;
  let rowTotal = 0;
  for (const fila of filas) {
    rowBaseTotal += fila.aulas_base;
    rowExtraTotal += fila.aulas_reemplazo;
    rowTotal += fila.aulas_total;
  }
  if (
    filas.some((fila) => fila.aulas_base + fila.aulas_reemplazo !== fila.aulas_total) ||
    resultado.aulas_base_total + resultado.aulas_extra_total !== resultado.aulas_total ||
    rowBaseTotal !== resultado.aulas_base_total ||
    rowExtraTotal !== resultado.aulas_extra_total ||
    rowTotal !== resultado.aulas_total
  ) return null;
  return {
    filas: [...filas],
    aulasBaseTotal: resultado.aulas_base_total,
    aulasExtraTotal: resultado.aulas_extra_total,
    aulasTotal: resultado.aulas_total,
    decision,
  };
}

/** Handoff operativo: copia los totales por facultad; no deriva aulas. */
export function planCursosHorarioPublicado(
  resultado: CursosHorarioResultado,
): Record<string, number> {
  return Object.fromEntries(resultado.filas.map((fila) => [fila.estrato, fila.aulas_total]));
}

export function planesCursosHorarioIguales(
  actual: Readonly<Record<string, number>>,
  guardado: Readonly<Record<string, number>>,
): boolean {
  const claves = Object.keys(actual);
  return claves.length === Object.keys(guardado).length &&
    claves.every((clave) => actual[clave] === guardado[clave]);
}

export function estadoPlanCursosHorario({
  confirmado,
  marcoDesactualizado,
  actual,
  guardado,
}: {
  confirmado: boolean;
  marcoDesactualizado: boolean;
  actual: Readonly<Record<string, number>>;
  guardado: Readonly<Record<string, number>>;
}) {
  const vigente = confirmado && !marcoDesactualizado &&
    planesCursosHorarioIguales(actual, guardado);
  return { vigente, puedeConfirmar: !marcoDesactualizado && !vigente };
}
