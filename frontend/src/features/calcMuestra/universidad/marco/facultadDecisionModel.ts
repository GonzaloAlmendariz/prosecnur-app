/**
 * Modelo PURO de la vista facultad-primaria de «Cursos-horario: criterios +
 * radiografía» (reunión con el asesor muestral §4): el tipo de curso relevante
 * CAMBIA por facultad, así que la decisión de criterios de curso-horario se
 * toma viendo la radiografía de esa facultad al lado. Aquí vive la lógica
 * calculable —orden de facultades, resolución de claves de excepción/mínimo y
 * conteo de decisiones propias por facultad— para que el `.tsx` solo presente
 * (patrón territorialSummaryModel). NO reimplementa selección/excepciones:
 * delega en los modelos puros existentes (tipoSesionModel, minElegiblesModel).
 */
import type {
  CalcMuestraAulasExploracion,
  CalcMuestraAulasExploracionFacultad,
  CriterioVariable,
  CriteriosSeleccionMarco,
} from "../../../../api/client";
import { normalizeUniversityLabel } from "../shared/format";
import { minimoFacultad } from "../criterios/minElegiblesModel";
import { filtrarFacultades } from "./exploradorModel";

/**
 * Slug estable para claves de facultad (sin tildes, minúsculas, guiones). Mismo
 * criterio que CriteriosMarcoTab: el backend re-normaliza al leer, así que la
 * clave solo debe ser estable y determinista para un mismo nombre de facultad.
 */
export function slugFacultad(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export type FacultadRefLike = { key: string; label: string };

/**
 * Un bloque de facultad de la vista integrada: la radiografía de la facultad
 * (`fac`) resuelta a las claves con que se persiste su decisión. Las excepciones
 * de session/condition/teacher viven en `exceptions[excKey]`; el mínimo propio
 * en `minEligible.byFaculty[minKey]`. Se resuelven por join de etiqueta con las
 * referencias del marco (mismo espacio de claves que CriteriosMarcoTab) y caen
 * al slug de la propia etiqueta si el join no encuentra correspondencia.
 */
export type FacultadBloque = {
  fac: CalcMuestraAulasExploracionFacultad;
  facLabel: string;
  excKey: string;
  minKey: string;
};

/**
 * Lista de bloques ordenada por elegibles desc (reusa `filtrarFacultades`), con
 * las claves de excepción y de mínimo resueltas por join de etiqueta. Sin
 * exploración ⇒ lista vacía (el llamador muestra el estado «construye el marco»).
 */
export function facultadesBloque(
  exploracion: CalcMuestraAulasExploracion | null | undefined,
  facRefs: ReadonlyArray<FacultadRefLike>,
  facultadesMin: ReadonlyArray<FacultadRefLike>,
): FacultadBloque[] {
  if (!exploracion) return [];
  const excPorLabel = new Map(facRefs.map((f) => [normalizeUniversityLabel(f.label), f.key]));
  const minPorLabel = new Map(facultadesMin.map((f) => [normalizeUniversityLabel(f.label), f.key]));
  return filtrarFacultades(exploracion.por_facultad, "").map((fac) => {
    const labelKey = normalizeUniversityLabel(fac.facultad);
    const fallback = slugFacultad(fac.facultad);
    return {
      fac,
      facLabel: fac.facultad,
      excKey: excPorLabel.get(labelKey) ?? fallback,
      minKey: minPorLabel.get(labelKey) ?? excPorLabel.get(labelKey) ?? fallback,
    };
  });
}

/** true si la facultad tiene una decisión PROPIA (excepción) en la variable. */
export function tieneDecisionPropia(
  seleccion: CriteriosSeleccionMarco | null | undefined,
  variableId: string,
  excKey: string,
): boolean {
  return Boolean(seleccion?.byVariable?.[variableId]?.exceptions?.[excKey]);
}

export type CriterioDecisionEstado = {
  variableId: string;
  label: string;
  /** true si la facultad decide propio; false si hereda el set global. */
  propia: boolean;
};

export type ResumenDecisionFacultad = {
  /** Detalle por criterio de toggle (session/condition/teacher). */
  detalles: CriterioDecisionEstado[];
  /** true si la facultad fija un mínimo propio de elegibles (criterio 7). */
  minPropio: boolean;
  /** Nº de criterios (toggle + mínimo) con decisión propia de la facultad. */
  propias: number;
  /** Total de criterios de curso-horario decidibles por facultad (toggle + 1). */
  total: number;
};

/**
 * Resumen de la decisión de una facultad: cuántos de los criterios de
 * curso-horario decide propio (excepción) vs. hereda del global. Alimenta la
 * pastilla del acordeón colapsado («hereda el global» / «N criterios propios»).
 */
export function resumenDecisionFacultad(
  seleccion: CriteriosSeleccionMarco | null | undefined,
  variablesToggle: ReadonlyArray<CriterioVariable>,
  excKey: string,
  minKey: string,
): ResumenDecisionFacultad {
  const detalles: CriterioDecisionEstado[] = variablesToggle.map((v) => ({
    variableId: v.id,
    label: v.label,
    propia: tieneDecisionPropia(seleccion, v.id, excKey),
  }));
  const minPropio = minimoFacultad(seleccion, minKey) != null;
  const propias = detalles.filter((d) => d.propia).length + (minPropio ? 1 : 0);
  return { detalles, minPropio, propias, total: detalles.length + 1 };
}
