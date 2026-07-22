import type {
  SurveyMonkeySavBundleFileInspection,
  SurveyMonkeySavNormalizationCatalogMapping,
  SurveyMonkeySavNormalizationStatus,
  SurveyMonkeySavNormalizationVariable,
} from "../../api/client";

export type SavNormalizationReviewFilter = "all" | "changes" | "warnings" | "metadata";

export type SavNormalizationConfirmationState = {
  requiredEntryNames: string[];
  confirmedEntryNames: string[];
  pendingEntryNames: string[];
  unavailableEntryNames: string[];
  complete: boolean;
};

export const SAV_NORMALIZATION_FILTERS: ReadonlyArray<{
  value: SavNormalizationReviewFilter;
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "changes", label: "Cambios" },
  { value: "warnings", label: "Advertencias" },
  { value: "metadata", label: "Metadatos" },
];

const STATUS_LABELS: Record<SurveyMonkeySavNormalizationStatus, string> = {
  unchanged: "Sin cambios",
  transformed: "Transformada",
  warning: "Requiere atención",
  source_only: "Solo metadato SAV",
};

const OPERATION_LABELS: Record<string, string> = {
  direct: "Conservar directamente",
  rename: "Renombrar",
  rename_source: "Renombrar origen",
  collapse_single_child: "Unificar columna hija",
  recode: "Recodificar",
  recode_choice_map: "Alinear catálogo",
  recode_other_zero: "Normalizar código de otro",
  rebuild_select_multiple: "Reconstruir selección múltiple",
  drop_source_dummies: "Retirar columnas auxiliares",
  fill_blank: "Completar en blanco",
  preserve_metadata: "Conservar metadato",
  preserve_extra: "Conservar columna adicional",
  cast: "Convertir tipo",
  coerce: "Convertir tipo",
  coerce_type: "Convertir tipo",
  normalize_missing: "Normalizar vacíos",
  preserve: "Conservar",
  metadata: "Separar metadato",
  source_only: "Conservar como metadato",
};

function normalizedSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

function variableSearchText(variable: SurveyMonkeySavNormalizationVariable): string {
  return [
    variable.id,
    ...variable.source_columns.flatMap((column) => [column.name, column.label, column.storage_type]),
    variable.xlsform?.name,
    variable.xlsform?.label,
    variable.xlsform?.type,
    variable.xlsform?.type_base,
    variable.xlsform?.list_name,
    ...variable.operations.flatMap((operation) => [operation.kind, operation.label, operation.detail, operation.source, operation.target]),
    ...variable.alerts.flatMap((alert) => [alert.code, alert.message]),
    ...(variable.catalog?.choices.flatMap((choice) => [choice.value, choice.label]) ?? []),
    ...(variable.catalog?.mappings.flatMap((mapping) => [
      mapping.source,
      mapping.target,
      mapping.source_label,
      mapping.target_label,
    ]) ?? []),
  ].filter((value): value is string => Boolean(value)).join(" ");
}

export function savNormalizationStatusLabel(status: SurveyMonkeySavNormalizationStatus): string {
  return STATUS_LABELS[status];
}

export function savNormalizationOperationLabel(kind: string, fallback = ""): string {
  const normalized = kind.trim().toLocaleLowerCase();
  if (OPERATION_LABELS[normalized]) return OPERATION_LABELS[normalized];
  if (fallback.trim()) return fallback.trim();
  return kind.trim().replace(/[_-]+/g, " ") || "Transformación";
}

export function savNormalizationVariableName(variable: SurveyMonkeySavNormalizationVariable): string {
  return variable.xlsform?.name || variable.source_columns[0]?.name || variable.id;
}

export function savNormalizationVariableLabel(variable: SurveyMonkeySavNormalizationVariable): string {
  return variable.xlsform?.label || variable.source_columns.find((column) => column.label)?.label || "Sin etiqueta de formulario";
}

export function savNormalizationVariableMatchesFilter(
  variable: SurveyMonkeySavNormalizationVariable,
  filter: SavNormalizationReviewFilter,
): boolean {
  if (filter === "changes") return variable.status === "transformed";
  if (filter === "warnings") {
    return variable.status === "warning" || variable.alerts.some((alert) => alert.severity !== "info");
  }
  if (filter === "metadata") return variable.status === "source_only" || variable.xlsform == null;
  return true;
}

export function filterSavNormalizationVariables(
  variables: readonly SurveyMonkeySavNormalizationVariable[],
  filter: SavNormalizationReviewFilter,
  query: string,
): SurveyMonkeySavNormalizationVariable[] {
  const normalizedQuery = normalizedSearch(query);
  return variables.filter((variable) => (
    savNormalizationVariableMatchesFilter(variable, filter)
    && (!normalizedQuery || normalizedSearch(variableSearchText(variable)).includes(normalizedQuery))
  ));
}

export function savNormalizationStatusCounts(variables: readonly SurveyMonkeySavNormalizationVariable[]) {
  return variables.reduce((counts, variable) => ({
    ...counts,
    [variable.status]: counts[variable.status] + 1,
  }), {
    unchanged: 0,
    transformed: 0,
    warning: 0,
    source_only: 0,
  } satisfies Record<SurveyMonkeySavNormalizationStatus, number>);
}

export function savNormalizationCatalogRows(
  variable: SurveyMonkeySavNormalizationVariable,
): SurveyMonkeySavNormalizationCatalogMapping[] {
  const mappings = variable.catalog?.mappings ?? [];
  if (mappings.length) return mappings;
  return (variable.catalog?.choices ?? []).map((choice) => ({
    source_code: choice.value,
    source_column: "",
    source_label: choice.label,
    xls_code: choice.value,
    xls_label: choice.label,
    match: "direct",
    source: choice.value,
    target: choice.value,
    target_label: choice.label,
  }));
}

export function savNormalizationConfirmationState(
  files: readonly SurveyMonkeySavBundleFileInspection[],
  reviewedEntryNames: ReadonlySet<string>,
): SavNormalizationConfirmationState {
  const reviewableFiles = files.filter((file) => !file.blocking);
  const requiredEntryNames = reviewableFiles.map((file) => file.entry_name);
  const unavailableEntryNames = reviewableFiles
    .filter((file) => !file.normalization_review)
    .map((file) => file.entry_name);
  const confirmedEntryNames = requiredEntryNames.filter((entryName) => reviewedEntryNames.has(entryName));
  const pendingEntryNames = requiredEntryNames.filter((entryName) => !reviewedEntryNames.has(entryName));
  return {
    requiredEntryNames,
    confirmedEntryNames,
    pendingEntryNames,
    unavailableEntryNames,
    complete: requiredEntryNames.length > 0
      && pendingEntryNames.length === 0
      && unavailableEntryNames.length === 0,
  };
}

export function savNormalizationApplyReason(
  files: readonly SurveyMonkeySavBundleFileInspection[],
  reviewedEntryNames: ReadonlySet<string>,
): string {
  const state = savNormalizationConfirmationState(files, reviewedEntryNames);
  if (state.unavailableEntryNames.length) {
    return `Falta el detalle de normalización para ${state.unavailableEntryNames.length} archivo${state.unavailableEntryNames.length === 1 ? "" : "s"}; reinspecciona antes de aplicar.`;
  }
  if (state.pendingEntryNames.length) {
    return `Confirma la revisión de ${state.pendingEntryNames.length} archivo${state.pendingEntryNames.length === 1 ? "" : "s"} antes de aplicar.`;
  }
  return "Todos los archivos no bloqueados tienen su normalización confirmada.";
}
