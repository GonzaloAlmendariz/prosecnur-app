import {
  type CalcMuestraAulasState,
  type CalcMuestraWorkspaceAulasConfig,
  type CriteriosSeleccionMarco,
} from "../../../../api/client";
import { seleccionActiva, seleccionVariable } from "../../dominio/criteriosMarco";
import { fmtInt, rowsFrom, safeNumber, type GuideStatus } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "./format";
import { filtrosLegacyPayload, normalizeTeacherTypeOrden } from "./study";

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

/**
 * true si la selección de criterios con la que se construyó el marco difiere de
 * la confirmada actualmente. Si el marco vigente no registró con qué selección
 * se construyó (marcos por defecto o previos a la suite: null o `{byVariable:{}}`)
 * NO afirmamos que esté desactualizado: solo "reconstruye" cuando hay un cambio
 * real y comparable — no de forma permanente al reabrir.
 */
function criteriosSeleccionDesactualizada(
  construido: CriteriosSeleccionMarco | null | undefined,
  configSeleccion: CriteriosSeleccionMarco | null | undefined,
): boolean {
  if (seleccionVacia(construido)) return false;
  if (seleccionVacia(configSeleccion)) return false;
  return !marcoDeepEqual(seleccionNormalizada(construido), seleccionNormalizada(configSeleccion));
}

/**
 * true si el orden de jerarquía de docente cambió desde que se construyó el
 * marco (ADR 0035): reordenar `teacher_type_orden` reetiqueta el `teacher_type_top`
 * de cada curso-horario, así que el marco vigente quedó obsoleto. El backend
 * expone en el frame el orden EFECTIVO con que construyó (`teacher_type_orden`).
 * Defensivo: marcos viejos que no traen el campo NO se marcan stale por eso
 * (mismo criterio que con `criterios_seleccion` ausente). El orden importa, así
 * que se compara elemento a elemento tras normalizar.
 */
function teacherTypeOrdenDesactualizado(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
  configTeacherTypeOrden: string[] | null | undefined,
): boolean {
  const rawFrameOrden = (frame as Record<string, unknown> | null | undefined)?.teacher_type_orden;
  if (!Array.isArray(rawFrameOrden)) return false; // marco viejo sin el campo
  const frameOrden = normalizeTeacherTypeOrden(rawFrameOrden);
  const configOrden = normalizeTeacherTypeOrden(configTeacherTypeOrden ?? undefined);
  // Config sin orden explícito = el usuario nunca reordenó → "usa el orden por
  // defecto", que es justo con el que el motor construyó (el frame guarda ese
  // orden efectivo, siempre poblado). Comparar [] contra los 8 por defecto daría
  // un "reconstruye" perpetuo; mismo guard de vacío que en criterios_seleccion.
  if (configOrden.length === 0) return false;
  if (frameOrden.length !== configOrden.length) return true;
  return frameOrden.some((key, index) => key !== configOrden[index]);
}

/** Parejas flag/umbral del eco de filtros que gobiernan el criterio 8
 *  (composición del aula) y la prevalencia referencial legacy (c7). */
const FILTROS_ECO_PARES = [
  ["require_min_prevalence", "min_prevalence_pct"],
  ["require_faculty_prevalence", "min_faculty_prevalence_pct"],
  ["require_cycle_homogeneity", "min_cycle_homogeneity_pct"],
] as const;

/** Config vigente para la señal de frescura del criterio 8: el aulas_config
 *  del workspace + los opcionales activos del Motor/Recorrido (c7/c8 también
 *  participan del payload efectivo del build). */
export type MarcoConfigVigente = {
  config: CalcMuestraWorkspaceAulasConfig;
  opcionalesActivos?: string[] | null;
};

/**
 * true si los filtros del criterio 8 / prevalencia referencial con los que se
 * construyó el marco (`frame.filters_echo`, eco normalizado del backend)
 * difieren de los EFECTIVOS vigentes. El payload efectivo se deriva con la
 * MISMA lógica del build (`filtrosLegacyPayload`): tarjeta de criterios
 * (aulas_config) ∪ opcionales c7/c8 del Motor, y suite inactiva ⇒ permisivo.
 *
 * Guards de compatibilidad: marcos viejos sin `filters_echo` (o con una
 * pareja no comparable) NUNCA se marcan desactualizados por esta vía — evita
 * el "reconstruye" perpetuo con marcos previos al eco. Los umbrales solo se
 * comparan con el flag encendido en ambos lados: apagado, el pct no filtra.
 */
function filtrosEchoDesactualizado(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
  vigente: MarcoConfigVigente,
): boolean {
  const eco = frame?.filters_echo;
  if (eco == null || typeof eco !== "object" || Array.isArray(eco)) return false;
  const ecoRegistro = eco as Record<string, unknown>;
  const opcionales = vigente.opcionalesActivos ?? [];
  const efectivo = filtrosLegacyPayload(
    vigente.config,
    seleccionActiva(vigente.config.criterios_seleccion),
    { c7: opcionales.includes("c7"), c8: opcionales.includes("c8") },
  );
  for (const [flagKey, pctKey] of FILTROS_ECO_PARES) {
    const ecoFlag = ecoRegistro[flagKey];
    if (typeof ecoFlag !== "boolean") continue; // eco parcial: no comparable
    const flagVigente = efectivo[flagKey] === true;
    if (ecoFlag !== flagVigente) return true;
    if (!ecoFlag) continue;
    const ecoPct = safeNumber(ecoRegistro[pctKey], Number.NaN);
    const pctVigente = safeNumber(efectivo[pctKey], Number.NaN);
    if (!Number.isFinite(ecoPct) || !Number.isFinite(pctVigente)) continue;
    if (Math.abs(ecoPct - pctVigente) > 1e-9) return true;
  }
  return false;
}

export function marcoCriteriosDesactualizado(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
  configSeleccion: CriteriosSeleccionMarco | null | undefined,
  configTeacherTypeOrden?: string[] | null,
  configVigente?: MarcoConfigVigente | null,
): boolean {
  if (!frame) return false;
  const construido = frame.criterios_seleccion ?? null;
  if (criteriosSeleccionDesactualizada(construido, configSeleccion)) return true;
  if (teacherTypeOrdenDesactualizado(frame, configTeacherTypeOrden)) return true;
  if (configVigente && filtrosEchoDesactualizado(frame, configVigente)) return true;
  return false;
}

export type MarcoConsistenciaDecision = {
  status: GuideStatus;
  title: string;
  hint: string;
  /** Audit que puede mostrarse como evidencia. Nunca acredita por sí mismo. */
  evidence: Record<string, unknown>;
  showRelationEvidence: boolean;
};

function auditRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** Cuenta también formas legacy malformadas sin convertirlas en "cero issues". */
function relationIssueCount(value: unknown): number {
  if (value == null) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value !== "object") return 1;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (!keys.length) return 0;
  const rows = rowsFrom(record);
  if (rows.length) return rows.length;
  if (Object.values(record).every((item) => Array.isArray(item) && item.length === 0)) return 0;
  return 1;
}

/** Un frame existe metodológicamente solo cuando contiene unidades o un N auditado. */
function marcoFrameUtilizable(frame: CalcMuestraAulasState["frame"] | null | undefined) {
  return Boolean(
    frame &&
    (
      rowsFrom(frame.aula_frame).length > 0 ||
      rowsFrom(frame.population).length > 0 ||
      frameAuditNumber(frame, "classroom_n") > 0 ||
      frameAuditNumber(frame, "classroom_included_n") > 0 ||
      frameAuditNumber(frame, "population_n") > 0
    )
  );
}

/**
 * Autoridad única del veredicto y copy de Consistencia. Interpreta el
 * `relation_audit` ya calculado por R; no deriva umbrales ni estadísticos.
 */
export function decidirConsistenciaMarco(
  sourceMode: string | null | undefined,
  frame: CalcMuestraAulasState["frame"] | null | undefined,
): MarcoConsistenciaDecision {
  const pending: MarcoConsistenciaDecision = {
    status: "pending",
    title: "Construye el marco para validar la consistencia.",
    hint: "Completa Datos → Fuentes y Datos → Variables, construye el marco y vuelve aquí antes de continuar a Diseño.",
    evidence: {},
    showRelationEvidence: false,
  };
  if (!frame || !marcoFrameUtilizable(frame)) return pending;

  const relationPresent = Object.prototype.hasOwnProperty.call(frame, "relation_audit");
  const relation = auditRecord(frame.relation_audit);
  const catalogLegacy = auditRecord(frame.catalog_audit);
  const evidence = relation ?? catalogLegacy ?? {};
  const used = relation?.used;
  const status = typeof relation?.status === "string" ? relation.status : undefined;
  const issueCount = relationIssueCount(relation?.issues);
  const legacyCatalogUsed = catalogLegacy?.used === true;
  const showRelationEvidence = Boolean(
    (relation && (used === true || issueCount > 0)) ||
    (!relation && legacyCatalogUsed),
  );
  const result = (
    decisionStatus: GuideStatus,
    title: string,
    hint: string,
  ): MarcoConsistenciaDecision => ({
    status: decisionStatus,
    title,
    hint,
    evidence,
    showRelationEvidence,
  });

  if (sourceMode === "dos_bases") {
    if (!relationPresent) {
      return result(
        "working",
        "La conciliación no está acreditada.",
        "El marco vigente no trae la auditoría de relación entre las dos fuentes. Reconstrúyelo antes de continuar a Diseño.",
      );
    }
    if (!relation) {
      return result(
        "working",
        "La conciliación no está acreditada.",
        "El motor no devolvió un estado reconocido para la relación entre fuentes. Reconstruye el marco antes de continuar a Diseño.",
      );
    }
    if (used === false) {
      return result(
        "working",
        "El catálogo no entró en la conciliación.",
        "Datos declara dos fuentes, pero el motor no usó un catálogo de cursos-horario. Revisa Datos → Fuentes y reconstruye el marco antes de continuar a Diseño.",
      );
    }
    if (used === true && status === "ok" && issueCount === 0) {
      return result(
        "ready",
        "Relación acreditada.",
        "El motor validó la relación entre la base principal y el catálogo. Puedes continuar a Diseño.",
      );
    }
    if (used === true && (status === "revisar" || (status === "ok" && issueCount > 0))) {
      return result(
        "working",
        "La relación requiere revisión.",
        "Resuelve los hallazgos y reconstruye el marco antes de continuar a Diseño.",
      );
    }
    if (used === true && status === "critico") {
      return result(
        "working",
        "La relación tiene problemas críticos.",
        "Corrige Datos → Fuentes o Datos → Variables y reconstruye el marco antes de continuar a Diseño.",
      );
    }
    return result(
      "working",
      "La conciliación no está acreditada.",
      "El motor no devolvió un estado reconocido para la relación entre fuentes. Reconstruye el marco antes de continuar a Diseño.",
    );
  }

  const singleSourceMode = sourceMode == null || sourceMode === "" || sourceMode === "base_madre";
  if (!singleSourceMode) {
    return result(
      "working",
      "La auditoría del marco no es reconocible.",
      "Revisa Datos → Fuentes y reconstruye el marco antes de continuar a Diseño.",
    );
  }

  if (!relationPresent && !legacyCatalogUsed) {
    return result(
      "ready",
      "Fuente única: la conciliación entre bases no aplica.",
      "El estudio usa una sola fuente; no hay una segunda base que conciliar. Puedes continuar a Diseño.",
    );
  }
  if (!relationPresent && legacyCatalogUsed) {
    return result(
      "working",
      "El marco vigente no coincide con la configuración de fuentes.",
      "El marco usó un catálogo separado, pero Datos declara una fuente única. Revisa Datos → Fuentes y reconstruye el marco antes de continuar a Diseño.",
    );
  }
  if (!relation) {
    return result(
      "working",
      "La auditoría del marco no es reconocible.",
      "Revisa Datos → Fuentes y reconstruye el marco antes de continuar a Diseño.",
    );
  }
  if (used === false && issueCount > 0) {
    return result(
      "working",
      "La fuente única requiere revisión.",
      "El motor reportó problemas en la llave de curso-horario. Revisa Datos → Variables y reconstruye el marco antes de continuar a Diseño.",
    );
  }
  if (legacyCatalogUsed && used !== true) {
    return result(
      "working",
      "El marco vigente no coincide con la configuración de fuentes.",
      "El marco usó un catálogo separado, pero Datos declara una fuente única. Revisa Datos → Fuentes y reconstruye el marco antes de continuar a Diseño.",
    );
  }
  if (
    used === false &&
    issueCount === 0 &&
    (status === undefined || status === "sin_catalogo") &&
    !legacyCatalogUsed
  ) {
    return result(
      "ready",
      "Fuente única: la conciliación entre bases no aplica.",
      "El estudio usa una sola fuente; no hay una segunda base que conciliar. Puedes continuar a Diseño.",
    );
  }
  if (used === true && status === "ok") {
    return result(
      "working",
      "El marco vigente no coincide con la configuración de fuentes.",
      "El marco usó un catálogo separado, pero Datos declara una fuente única. Revisa Datos → Fuentes y reconstruye el marco antes de continuar a Diseño.",
    );
  }
  if (used === true && status === "revisar") {
    return result(
      "working",
      "El marco vigente usó un catálogo separado y requiere revisión.",
      "Alinea Datos → Fuentes y reconstruye el marco antes de continuar a Diseño.",
    );
  }
  if (used === true && status === "critico") {
    return result(
      "working",
      "La relación usada por el marco tiene problemas críticos.",
      "Corrige Datos → Fuentes o Datos → Variables y reconstruye el marco antes de continuar a Diseño.",
    );
  }
  return result(
    "working",
    "La auditoría del marco no es reconocible.",
    "Revisa Datos → Fuentes y reconstruye el marco antes de continuar a Diseño.",
  );
}

export function evaluarConsistenciaMarco(
  sourceMode: string | null | undefined,
  frame: CalcMuestraAulasState["frame"] | null | undefined,
): GuideStatus {
  return decidirConsistenciaMarco(sourceMode, frame).status;
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
  return marcoFrameUtilizable(aulasState?.frame ?? null);
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
