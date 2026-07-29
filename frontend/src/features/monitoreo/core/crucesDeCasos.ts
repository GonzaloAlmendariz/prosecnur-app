/**
 * Puente entre un caso real del corte y el balance de cruce.
 *
 * Vive en core/ y no en un page-file: los dos perfiles —Acreditación y
 * Telefónico— lo usan, y esos archivos están congelados a crecimiento; además
 * su contrato de readiness resuelve identificadores sobre el AST completo, así
 * que cada nombre nuevo allí cuesta.
 */

import type { MonitoreoInternalQueryCase } from "../../../api/monitoreo";
import { internalCaseCrossingValue, internalCaseResponseStateValue } from "../internalQueries";
import {
  balanceDeCruce,
  filasDeCruce,
  lecturaDeCruce,
  type CasoDeCruce,
  type FilaDeCruce,
} from "./balanceDeCruce";
import { motivoDeNoCruce } from "./motivoDeNoCruce";

/** Mismo criterio de no cruce que usa el resto del perfil. */
export function casoCruzo(item: MonitoreoInternalQueryCase) {
  const crossing = internalCaseCrossingValue(item);
  return crossing !== "sin_cruce" && crossing !== "sin_llave" && crossing !== "sin_base";
}

export function clasificarCaso(item: MonitoreoInternalQueryCase): CasoDeCruce {
  return {
    cruzo: casoCruzo(item),
    prioridad: motivoDeNoCruce(
      item,
      internalCaseResponseStateValue(item),
      internalCaseCrossingValue(item),
    ).prioridad,
  };
}

export function filasDeCruceDeCasos(
  cases: MonitoreoInternalQueryCase[],
  limite?: number,
): FilaDeCruce<MonitoreoInternalQueryCase>[] {
  return filasDeCruce(cases, clasificarCaso, limite);
}

export function lecturaDeCruceDeCasos(cases: MonitoreoInternalQueryCase[]) {
  return lecturaDeCruce(balanceDeCruce(cases.map(clasificarCaso)));
}
