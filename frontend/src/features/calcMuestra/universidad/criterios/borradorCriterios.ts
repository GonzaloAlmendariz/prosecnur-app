import type {
  CriterioVariable,
  CriteriosSeleccionMarco,
} from "../../../../api/client";
import { ELEGIBLES_POR_AULA_ID } from "../../dominio";

export type TipoBorradorCriterio = CriterioVariable["kind"] | "minEligible" | "manualExcluded";

/**
 * Copia solamente el fragmento que pertenece a una variable. Así una
 * confirmación nunca arrastra ediciones todavía abiertas en otras tarjetas.
 */
export function copiarVariableCriterio(
  destino: CriteriosSeleccionMarco,
  fuente: CriteriosSeleccionMarco,
  variableId: string,
  tipo: TipoBorradorCriterio,
): CriteriosSeleccionMarco {
  if (variableId === ELEGIBLES_POR_AULA_ID || tipo === "minEligible") {
    return {
      ...destino,
      minEligible: fuente.minEligible
        ? {
            ...fuente.minEligible,
            byFaculty: fuente.minEligible.byFaculty
              ? { ...fuente.minEligible.byFaculty }
              : undefined,
          }
        : undefined,
    };
  }

  if (tipo === "manualExcluded") {
    return {
      ...destino,
      manualExcludedClassrooms: fuente.manualExcludedClassrooms
        ? [...fuente.manualExcludedClassrooms]
        : undefined,
    };
  }

  if (tipo === "range") {
    return {
      ...destino,
      courseLevelRanges: fuente.courseLevelRanges
        ? Object.fromEntries(
            // Copia profunda preservando el shape de alambre (pares de la UI,
            // {min,max} o exención del motor); normalizar aquí rompería la
            // exención. La lectura normaliza vía rangosFacultad.
            Object.entries(fuente.courseLevelRanges).map(([facultad, rangos]) => [
              facultad,
              rangos.map((r) => (Array.isArray(r) ? ([r[0], r[1]] as [number, number]) : { ...r })),
            ]),
          )
        : undefined,
    };
  }

  const byVariable = { ...destino.byVariable };
  const fuenteVariable = fuente.byVariable[variableId];
  if (fuenteVariable) byVariable[variableId] = fuenteVariable;
  else delete byVariable[variableId];
  return { ...destino, byVariable };
}

/**
 * Incorpora una nueva selección confirmada sin perder los borradores que el
 * usuario todavía no decidió confirmar ni descartar.
 */
export function reconciliarBorradorCriterios(
  confirmado: CriteriosSeleccionMarco,
  borradorAnterior: CriteriosSeleccionMarco,
  pendientes: ReadonlySet<string>,
  tipos: ReadonlyMap<string, TipoBorradorCriterio>,
): CriteriosSeleccionMarco {
  let next = confirmado;
  for (const variableId of pendientes) {
    next = copiarVariableCriterio(
      next,
      borradorAnterior,
      variableId,
      tipos.get(variableId) ?? "flat",
    );
  }
  return next;
}
