import {
  type CalcMuestraAulasState,
  type CriteriosSeleccionMarco,
} from "../../../../api/client";
import { seleccionVariable } from "../../dominio/criteriosMarco";
import { fmtInt, rowsFrom, safeNumber } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "./format";

/** Un valor "vacío/ausente" a efectos de comparar selecciones. La selección que
 *  el frame ECHA desde el backend viene verbosa (`fromValue: "NA"`, `layer: null`,
 *  `threshold: {}`, `includeValues: []`, `exceptions: []`), mientras que la
 *  selección del frontend es lean. El codebase ya trata "NA"/`{}` como AUSENTES
 *  (ver `seleccionVariable`); tratarlos como equivalentes aquí evita un falso
 *  "desactualizado" perpetuo por diferencias de forma sin cambio de significado. */
function selVacio(x: unknown): boolean {
  if (x == null || x === "" || x === "NA") return true;
  if (Array.isArray(x)) return x.length === 0;
  if (typeof x === "object") {
    return Object.keys(x as Record<string, unknown>).every((k) =>
      selVacio((x as Record<string, unknown>)[k]),
    );
  }
  return false;
}

/** Igualdad SEMÁNTICA de selecciones (orden de claves irrelevante; arrays
 *  sensibles al orden; vacíos ausentes/null/"NA"/[]/{} son equivalentes). Copia
 *  local para no crear un ciclo con corridas.ts (que importa de este módulo). */
function marcoDeepEqual(a: unknown, b: unknown): boolean {
  if (selVacio(a) && selVacio(b)) return true;
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => marcoDeepEqual(item, b[index]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = Object.keys(objA).filter((key) => !selVacio(objA[key]));
    const keysB = Object.keys(objB).filter((key) => !selVacio(objB[key]));
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => marcoDeepEqual(objA[key], objB[key]));
  }
  return false;
}

/**
 * true si el marco vigente se construyó con una selección de criterios distinta
 * a la confirmada actualmente en el workspace → el marco quedó desactualizado y
 * hay que reconstruirlo. Señal EXACTA (no una estimación): el frame guarda la
 * selección con que se construyó (`frame.criterios_seleccion`).
 */
function seleccionVacia(sel: CriteriosSeleccionMarco | null | undefined): boolean {
  return !sel || Object.keys(sel.byVariable ?? {}).length === 0;
}

/** Reduce una selección a sus campos con SIGNIFICADO para comparar. `seleccionVariable`
 *  descarta la metadata que el backend echa desde el registro (scope/kind) y que el
 *  frontend no carga; combinado con la igualdad que ignora vacíos ([]/{}/"NA"/null),
 *  una selección verbosa del frame y la lean del frontend con el mismo contenido son
 *  equivalentes (evita el "reconstruye" perpetuo tras auto-sanear). */
function seleccionNormalizada(sel: CriteriosSeleccionMarco | null | undefined) {
  const byVariable: Record<string, unknown> = {};
  for (const id of Object.keys(sel?.byVariable ?? {})) byVariable[id] = seleccionVariable(sel, id);
  return {
    byVariable,
    courseLevelRanges: sel?.courseLevelRanges ?? {},
    minEligible: sel?.minEligible ?? {},
  };
}

export function marcoCriteriosDesactualizado(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
  configSeleccion: CriteriosSeleccionMarco | null | undefined,
): boolean {
  if (!frame) return false;
  const construido = frame.criterios_seleccion ?? null;
  // Si el marco vigente no registró con qué selección se construyó (marcos por
  // defecto o previos a la suite: null o `{byVariable:{}}`), NO afirmamos que
  // esté desactualizado: solo mostramos "reconstruye" cuando hay un cambio real
  // y comparable — no de forma permanente al reabrir. Al reconstruir con
  // criterios el frame registra su selección y la comparación vuelve a ser exacta.
  if (seleccionVacia(construido)) return false;
  if (seleccionVacia(configSeleccion)) return false;
  return !marcoDeepEqual(seleccionNormalizada(construido), seleccionNormalizada(configSeleccion));
}

export function frameAuditValue(frame: CalcMuestraAulasState["frame"] | null | undefined, metric: string) {
  const auditRows = rowsFrom<Record<string, unknown>>(frame?.audit);
  const row = auditRows.find((item) => classroomRowText(item, ["metric"]) === metric);
  return row ? classroomRowText(row, ["value"]) : "";
}

export function frameAuditNumber(frame: CalcMuestraAulasState["frame"] | null | undefined, metric: string) {
  return safeNumber(frameAuditValue(frame, metric), 0);
}

export type ClassroomAuditCard = {
  label: string;
  value: string;
  detail: string;
};

export function classroomInputModeLabel(value: string) {
  if (value === "dos_bases") return "Base + catálogo";
  if (value === "seleccion_existente") return "Selección previa";
  if (value === "base_madre") return "Base principal";
  if (!value) return "Base pendiente";
  const label = value.replace(/_/g, " ").trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Base pendiente";
}

export function frameAuditCards(frame: CalcMuestraAulasState["frame"] | null | undefined): ClassroomAuditCard[] {
  if (!frame) return [];
  const inputMode = frameAuditValue(frame, "input_mode");
  const inputRows = frameAuditNumber(frame, "input_rows");
  const eligibleRows = frameAuditNumber(frame, "eligible_student_rows");
  const populationN = frameAuditNumber(frame, "population_n");
  const classroomRows = frameAuditNumber(frame, "classroom_included_n") || frameAuditNumber(frame, "classroom_n");
  const excludedRows = frameAuditNumber(frame, "excluded_rows");
  const uniqueDetail = eligibleRows && populationN && eligibleRows !== populationN
    ? `${fmtInt(eligibleRows)} filas elegibles se consolidan en estudiantes únicos.`
    : "Base que alimenta cuotas, balance y monitoreo.";
  return [
    {
      label: "Base recibida",
      value: classroomInputModeLabel(inputMode),
      detail: inputMode === "dos_bases"
        ? "Estudiantes vinculados con catálogo de cursos y horarios."
        : "La lectura parte del archivo institucional cargado.",
    },
    {
      label: "Filas del archivo",
      value: inputRows ? fmtInt(inputRows) : "pendiente",
      detail: "Filas originales antes de filtros y deduplicación.",
    },
    {
      label: "Estudiantes elegibles",
      value: populationN ? fmtInt(populationN) : eligibleRows ? fmtInt(eligibleRows) : "pendiente",
      detail: uniqueDetail,
    },
    {
      label: "Cursos-horario seleccionables",
      value: classroomRows ? fmtInt(classroomRows) : "pendiente",
      detail: excludedRows ? `${fmtInt(excludedRows)} filas quedan fuera y auditadas.` : "Curso-horario listo para selección.",
    },
  ];
}

export function classroomFrameReady(aulasState: CalcMuestraAulasState | null) {
  const frame = aulasState?.frame ?? null;
  return Boolean(
    rowsFrom(frame?.aula_frame).length ||
    rowsFrom(frame?.population).length ||
    frameAuditNumber(frame, "classroom_n") > 0 ||
    frameAuditNumber(frame, "classroom_included_n") > 0 ||
    frameAuditNumber(frame, "population_n") > 0,
  );
}

export function classroomComparisonForState(aulasState: CalcMuestraAulasState | null) {
  return aulasState?.method_comparison ?? aulasState?.selection?.method_comparison ?? null;
}

export function classroomComparisonReady(aulasState: CalcMuestraAulasState | null) {
  const comparison = classroomComparisonForState(aulasState);
  return Boolean(
    comparison &&
    (
      rowsFrom(comparison.methods).length ||
      rowsFrom(comparison.balance).length ||
      rowsFrom(comparison.simulation_summary).length ||
      comparison.recommendation
    ),
  );
}

export function classroomSelectionForState(aulasState: CalcMuestraAulasState | null) {
  return aulasState?.selection ?? null;
}

export function classroomSelectionRowsForState(aulasState: CalcMuestraAulasState | null) {
  return rowsFrom<Record<string, unknown>>(classroomSelectionForState(aulasState)?.selection);
}

export function classroomM1RowsForState(aulasState: CalcMuestraAulasState | null) {
  return classroomSelectionRowsForState(aulasState).filter((row) => classroomRowText(row, ["sample_role"]) === "titular" || classroomRowText(row, ["wave"]) === "M1");
}

export function classroomReserveRowsForState(aulasState: CalcMuestraAulasState | null) {
  return classroomSelectionRowsForState(aulasState).filter((row) => {
    const wave = classroomRowText(row, ["wave"]);
    const role = classroomRowText(row, ["sample_role"]);
    return role === "chain_reserve" || Boolean(wave && wave !== "M1" && role !== "extra_reserve_pool");
  });
}

export function classroomExtraReserveRowsForState(aulasState: CalcMuestraAulasState | null) {
  return classroomSelectionRowsForState(aulasState).filter((row) => classroomRowText(row, ["sample_role"]) === "extra_reserve_pool");
}

export function classroomSelectionReady(aulasState: CalcMuestraAulasState | null) {
  return classroomM1RowsForState(aulasState).length > 0;
}

export function classroomReplacementSimulationForState(aulasState: CalcMuestraAulasState | null) {
  const selection = classroomSelectionForState(aulasState);
  return aulasState?.replacement_simulation ?? selection?.replacement_simulation ?? null;
}

export function classroomReplacementReady(aulasState: CalcMuestraAulasState | null) {
  const simulation = classroomReplacementSimulationForState(aulasState);
  return Boolean(
    classroomReserveRowsForState(aulasState).length &&
    simulation &&
    (
      rowsFrom((simulation as Record<string, unknown>).suggestions).length ||
      rowsFrom((simulation as Record<string, unknown>).replacement_suggestions).length ||
      rowsFrom((simulation as Record<string, unknown>).impact).length ||
      rowsFrom((simulation as Record<string, unknown>).summary).length
    ),
  );
}

export function classroomMetricValue(rows: Array<Record<string, unknown>>, metric: string) {
  const row = rows.find((item) => classroomRowText(item, ["metric"]) === metric);
  return row ? classroomRowNumber(row, ["value"]) : Number.NaN;
}
