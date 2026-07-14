import {
  type CalcMuestraAulasState,
  type CriteriosSeleccionMarco,
} from "../../../../api/client";
import { fmtInt, rowsFrom, safeNumber } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "./format";

/** Igualdad estructural mínima (orden de claves irrelevante; arrays sensibles al
 *  orden). Copia local para no crear un ciclo con corridas.ts (que importa de
 *  este módulo). Suficiente para comparar dos selecciones de criterios. */
function marcoDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => marcoDeepEqual(item, b[index]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = Object.keys(objA).filter((key) => objA[key] !== undefined);
    const keysB = Object.keys(objB).filter((key) => objB[key] !== undefined);
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
export function marcoCriteriosDesactualizado(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
  configSeleccion: CriteriosSeleccionMarco | null | undefined,
): boolean {
  if (!frame) return false;
  const construido = frame.criterios_seleccion ?? null;
  const confirmado = configSeleccion ?? null;
  if (!construido && !confirmado) return false;
  return !marcoDeepEqual(construido ?? {}, confirmado ?? {});
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
