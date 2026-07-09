/**
 * Mini-historial de corridas del desk "Muestra de aulas": registro en el
 * workspace del estudio (persistencia .pulso vía el save normal) de cada
 * corrida exitosa de cálculo de muestra y de selección de aulas, con cap de
 * 12 corridas (FIFO) para poder comparar dos diseños lado a lado.
 *
 * Todo es puro y retrocompatible: proyectos viejos sin `run_history` se leen
 * con fallback [] y el primer registro crea el campo.
 */
import type {
  CalcMuestraAulasState,
  CalcMuestraComponente,
  CalcMuestraCorrida,
  CalcMuestraWorkspace,
} from "../../api/client";
import {
  classroomExtraReserveRowsForState,
  classroomM1RowsForState,
  classroomReserveRowsForState,
  classroomSelectionForState,
} from "./universidad/shared/frame";
import { safeNumber, uid } from "./sharedCore";

/** Cap del historial: se conservan las últimas 12 corridas (FIFO). */
export const CORRIDAS_MAX = 12;

/** Lee el historial con fallback [] (proyectos viejos no traen el campo). */
export function historialCorridas(
  workspace: CalcMuestraWorkspace | null | undefined,
): CalcMuestraCorrida[] {
  const raw = workspace?.run_history;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is CalcMuestraCorrida =>
    Boolean(item && typeof item === "object" && typeof item.id === "string" && item.id),
  );
}

/** Agrega una corrida al final (orden cronológico) respetando el cap FIFO. */
export function registrarCorrida(
  workspace: CalcMuestraWorkspace,
  corrida: CalcMuestraCorrida,
): CalcMuestraWorkspace {
  const historial = [...historialCorridas(workspace), corrida];
  return {
    ...workspace,
    run_history: historial.slice(Math.max(0, historial.length - CORRIDAS_MAX)),
  };
}

function numeroOpcional(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Construye el registro de una corrida de cálculo (recalcular muestra).
 *  Devuelve null si el componente aún no tiene resultado útil. */
export function corridaDeCalculo({
  totalComp,
  workspace,
}: {
  totalComp: CalcMuestraComponente | undefined;
  workspace: CalcMuestraWorkspace;
}): CalcMuestraCorrida | null {
  const resultado = totalComp?.resultado;
  if (!totalComp || !resultado) return null;
  const nObjetivo = numeroOpcional(resultado.n_objetivo);
  if (!nObjetivo || nObjetivo <= 0) return null;
  return {
    id: uid("run"),
    timestamp: new Date().toISOString(),
    tipo: "calculo",
    metodo: totalComp.tecnica,
    semilla: numeroOpcional(workspace.aulas_config?.semilla),
    n_objetivo: nObjetivo,
    parametros: {
      z: numeroOpcional(totalComp.parametros.z),
      e: numeroOpcional(totalComp.parametros.e),
      p: numeroOpcional(totalComp.parametros.p),
      deff: numeroOpcional(totalComp.parametros.deff),
      sobremuestra: numeroOpcional(totalComp.parametros.oversample_pct),
    },
    resumen: {
      n: nObjetivo,
    },
  };
}

const CLAVES_ESPERADOS = ["eligible_n", "expected_valid", "enrolled_total"];

function esperadosDeFilas(rows: Array<Record<string, unknown>>): number {
  return rows.reduce((sum, row) => {
    for (const key of CLAVES_ESPERADOS) {
      const value = Number(row[key]);
      if (Number.isFinite(value) && value > 0) return sum + value;
    }
    return sum;
  }, 0);
}

/** Construye el registro de una corrida de selección de aulas.
 *  Devuelve null si el estado no trae una selección con titulares. */
export function corridaDeSeleccion({
  aulasState,
  workspace,
}: {
  aulasState: CalcMuestraAulasState | null;
  workspace: CalcMuestraWorkspace;
}): CalcMuestraCorrida | null {
  const selection = classroomSelectionForState(aulasState);
  const m1Rows = classroomM1RowsForState(aulasState);
  if (!selection || m1Rows.length === 0) return null;
  const reservas =
    classroomReserveRowsForState(aulasState).length +
    classroomExtraReserveRowsForState(aulasState).length;
  const representatividad = numeroOpcional(
    selection.representativity_score ?? selection.representativity?.overall_score,
  );
  const config = workspace.aulas_config;
  return {
    id: uid("run"),
    timestamp: new Date().toISOString(),
    tipo: "seleccion",
    metodo: String(selection.selector_engine_used ?? selection.selector_engine ?? config?.selector ?? ""),
    semilla: numeroOpcional(selection.seed) ?? numeroOpcional(config?.semilla),
    parametros: {
      waves: numeroOpcional(config?.bolsas_reemplazo),
      aulas_objetivo: m1Rows.length,
    },
    resumen: {
      titulares: m1Rows.length,
      reservas,
      esperados: Math.round(esperadosDeFilas(m1Rows)),
      representatividad,
    },
  };
}

/**
 * Igualdad profunda por valor (independiente del orden de claves de objetos;
 * los arrays sí son sensibles al orden). Se usa para que los efectos de
 * auto-reparación/hidratación no ensucien el estado con patches no-op.
 */
export function jsonIgual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a === "number" && typeof b === "number") return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => jsonIgual(item, b[index]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    // undefined equivale a "clave ausente" (mismo criterio que JSON).
    const keysA = Object.keys(objA).filter((key) => objA[key] !== undefined);
    const keysB = Object.keys(objB).filter((key) => objB[key] !== undefined);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => jsonIgual(objA[key], objB[key]));
  }
  return false;
}

/** Ayuda visible del historial: cuánto vale mostrar de cada corrida. */
export function tituloCorrida(corrida: CalcMuestraCorrida): string {
  if (corrida.tipo === "seleccion") {
    const titulares = corrida.resumen?.titulares;
    return titulares ? `${titulares} aulas titulares` : "selección de aulas";
  }
  const n = corrida.n_objetivo ?? corrida.resumen?.n;
  return n ? `n = ${n}` : "cálculo de muestra";
}
