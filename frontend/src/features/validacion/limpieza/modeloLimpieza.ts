/**
 * Modelo puro de la mesa de limpieza: el formulario de una decisión, cómo se
 * arma desde la cola y desde una decisión guardada, el cuerpo que se manda al
 * guardar y los textos que la resumen.
 *
 * Salió sin cambios de `tabs/LimpiezaTab.tsx` (rebanada V1 de P6). Lo que se
 * guarda lo fija la caracterización (`caracterizacion/limpieza.test.tsx`).
 */
import type { InstrumentoDrillResult } from "../../../api/client";
import { normalizarCaseIds } from "../../../api/validacionAuditoria";
import type { DecisionesPreservadas, LimpiezaDecision, LimpiezaDecisionActionType, LimpiezaQueueItem, ReglaTreatmentScope } from "../types";
import type { DecisionCounts, ReglaLike, VariableHoverData } from "../components/v2";

export const NEW_DECISION = "__new__";

export const numberFormatter = new Intl.NumberFormat("es-PE");
export const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export type EditorForm = {
  id: string;
  source_type: LimpiezaDecision["source_type"];
  action_type: LimpiezaDecisionActionType;
  target_variable: string;
  rationale: string;
  scope_mode: ReglaTreatmentScope;
  use_all_cases: boolean;
  target_case_ids: string[];
  replace_from: string;
  replace_to: string;
  normalize_from: string;
  normalize_to: string;
  hierarchy_map_json: string;
  set_value: string;
  recode_map_json: string;
  nullify_variables_text: string;
  sm_add_codes: string;
  sm_remove_codes: string;
  impute_method: "fixed" | "mode" | "median";
  impute_fixed_value: string;
};

export type CaseRow = {
  /** El id de caso del motor o, si no lo hay, una clave de la fila que no se manda nunca (ver `seleccionable`). */
  id: string;
  /**
   * `false` si el motor no pudo ubicar la fila y su id llegó `null` (Corrección
   * 15-M): esa fila no se puede elegir para una decisión caso por caso. Antes
   * se le inventaba `<regla>::row::<k>`, que el motor rechaza al guardar
   * (422 `E_LIMPIEZA_CASOS_INVALIDOS`).
   */
  seleccionable: boolean;
  raw: Record<string, unknown>;
  summary: string;
};

/** Clave de una fila sin id de caso. No es un id: `buildDecisionPayload` la rechaza. */
export function claveDeFilaSinId(posicion: number): string {
  return `Caso sin identificador ${posicion}`;
}

const CLAVE_SIN_ID = /^Caso sin identificador \d+$/;

export function esFilaSinId(id: string): boolean {
  return CLAVE_SIN_ID.test(id);
}

export type ChoiceOption = {
  code: string;
  label: string;
  n: number | null;
};

export type DecisionReadiness = {
  ready: boolean;
  issues: string[];
};

export const ACTION_OPTIONS: Array<{
  value: LimpiezaDecisionActionType;
  label: string;
}> = [
  { value: "ignore_rule", label: "Registrar sin cambios" },
  { value: "replace_value", label: "Corregir valor" },
  { value: "set_value", label: "Asignar valor" },
  { value: "recode_map", label: "Recodificar equivalencias" },
  { value: "complete_select_multiple_hierarchy", label: "Completar selección múltiple" },
  { value: "adjust_select_multiple", label: "Agregar o quitar opciones" },
  { value: "nullify_fields", label: "Anular campos" },
  { value: "exclude_cases", label: "Excluir registros" },
];

export const LEGACY_ACTION_OPTIONS: Array<{
  value: LimpiezaDecisionActionType;
  label: string;
}> = [
  { value: "normalize_value", label: "Normalizar valor (anterior)" },
  { value: "impute_value", label: "Imputar (anterior)" },
];

// -----------------------------------------------------------------------------
// Helper: derivar distribución de decisiones para DecisionStorageBar.
// Los counts son por CASOS (no por reglas) — cada regla con decisión lista
// contribuye sus n_casos al kind correspondiente. Las pendientes van al
// segmento striped.
// -----------------------------------------------------------------------------
export function deriveDecisionCounts(queue: LimpiezaQueueItem[]): DecisionCounts {
  const counts: DecisionCounts = {
    ignore: 0, exclude: 0, change: 0, pending: 0,
  };
  for (const item of queue) {
    const n = item.n_casos ?? 0;
    if (!n) continue;
    const covered = item.n_casos_cubiertos ?? (item.pending ? 0 : n);
    const pending = item.n_casos_pendientes ?? (item.pending ? n : 0);
    if (pending > 0) counts.pending += pending;
    if (covered <= 0) continue;
    // Item tiene decisión lista — inferir kind desde current_action (string
    // legible) o source_type.
    const action = (item.current_action ?? "").toLowerCase();
    if (isDocumentedActionLabel(action)) counts.ignore += covered;
    else if (action.startsWith("excluir")) counts.exclude += covered;
    else if (isCorrectionActionLabel(action)) counts.change += covered;
    else counts.ignore += covered; // fallback conservador si el label no calza
  }
  return counts;
}

export function isDocumentedActionLabel(action: string) {
  return action.startsWith("documentar") || action.startsWith("no modificar") || action.startsWith("ignorar");
}

export function isCorrectionActionLabel(action: string) {
  return (
    action.startsWith("corregir") ||
    action.startsWith("reemplazar") ||
    action.startsWith("asignar") ||
    action.startsWith("recodificar") ||
    action.startsWith("anular") ||
    action.startsWith("ajustar") ||
    action.startsWith("normalizar") ||
    action.startsWith("imputar") ||
    action.startsWith("completar")
  );
}

export function actionOptionsFor(actionType: LimpiezaDecisionActionType, item?: LimpiezaQueueItem | null) {
  const smSuggested = isSelectMultipleItem(item);
  const values = new Set<LimpiezaDecisionActionType>([
    "ignore_rule",
    "replace_value",
    "set_value",
    "recode_map",
    "nullify_fields",
    "exclude_cases",
  ]);
  if (smSuggested || actionType === "complete_select_multiple_hierarchy" || actionType === "adjust_select_multiple") {
    values.add("complete_select_multiple_hierarchy");
    values.add("adjust_select_multiple");
  }
  const base = ACTION_OPTIONS.filter((option) => values.has(option.value));
  if (actionType === "normalize_value" || actionType === "impute_value") {
    return [
      ...base,
      ...LEGACY_ACTION_OPTIONS.filter((option) => option.value === actionType),
    ];
  }
  return base;
}

// Convierte un LimpiezaQueueItem al shape ReglaLike que consume RuleNarrative.
export function queueItemToRule(
  item: LimpiezaQueueItem,
  drill?: InstrumentoDrillResult | null,
): ReglaLike {
  const reglaDrill = drill?.regla;
  return {
    id: item.source_id,
    nombre: item.nombre_regla,
    tipo_regla: item.tipo_regla,
    tipo_observacion: item.tipo_observacion,
    tipo_variable: item.tipo_variable,
    fuente: item.fuente,
    hallazgo_kind: item.hallazgo_kind ?? null,
    origen_detalle: item.origen_detalle ?? null,
    severidad: item.severidad,
    categoria_ux: item.categoria_ux,
    objetivo: reglaDrill?.objetivo ?? null,
    variables: item.variables ?? [],
    variable_roles: null, // derivar por fallback (primera var = target)
    presentation: null,
    n_casos: item.n_casos,
    porcentaje: item.porcentaje,
  };
}

// Hover data para una variable: label del instrumento + sección + tabla, si hay drill.
// Deriva label por variable desde drill.regla.variable_roles.labels (si viene)
// y usa tables para inferir el grupo.
export function buildVariableHoverLookup(
  drill: InstrumentoDrillResult | null,
): (varName: string) => VariableHoverData | undefined {
  if (!drill?.regla) return () => undefined;
  const seccion = drill.regla.seccion ?? null;
  const roles = drill.regla.variable_roles ?? null;
  const labels = roles?.labels ?? null;
  const tables = roles?.tables ?? null;
  return (varName: string): VariableHoverData | undefined => {
    if (!varName) return undefined;
    return {
      label: labels?.[varName] ?? null,
      seccion,
      grupo: tables?.[varName] ?? null,
    };
  };
}

// Las decisiones que sobrevivieron a una recarga de instrumento esperan en
// cuarentena: no se aplican ni salen en la cola hasta que su regla reaparezca y
// su variable siga en el formulario. Si la pestaña no lo dice, el analista da
// por perdido un trabajo que sigue ahí.
//
// El motivo cambia lo que hay que hacer, así que cambia el mensaje y el tono:
// esperar la auditoría es una buena noticia, y quedarse sin la variable es una
// pérdida real que ya no se recupera sola.
export function describirDecisionesPreservadas(
  preservadas: DecisionesPreservadas | undefined,
): { texto: string; tone: "success" | "warn" } | null {
  const n = preservadas?.n ?? 0;
  if (!Number.isFinite(n) || n <= 0) return null;
  const cuantas = n === 1 ? "1 decisión" : `${n} decisiones`;

  const sinEvaluar = preservadas?.n_sin_evaluar ?? 0;
  if (sinEvaluar > 0) {
    const casos = preservadas?.n_casos ?? 0;
    const cuantos = casos === 1 ? "1 caso" : `${casos} casos`;
    return {
      tone: "success",
      texto:
        `Se guardaron ${cuantas} de limpieza (${cuantos}) que habías tomado con el formulario anterior. ` +
        `Corre la auditoría para recuperarlas: volverán a la cola las que sigan teniendo su regla y su ` +
        `variable en el formulario nuevo.`,
    };
  }

  const motivos: string[] = [];
  const sinRegla = preservadas?.n_sin_regla ?? 0;
  const sinVariable = preservadas?.n_sin_variable ?? 0;
  const sinInstrumento = preservadas?.n_sin_instrumento ?? 0;
  if (sinRegla > 0) {
    motivos.push(`${sinRegla} porque la regla que las originó ya no existe`);
  }
  if (sinVariable > 0) {
    motivos.push(`${sinVariable} porque su variable ya no está en el formulario`);
  }
  if (sinInstrumento > 0) {
    motivos.push(`${sinInstrumento} porque no se pudo leer el formulario`);
  }
  return {
    tone: "warn",
    texto:
      `${cuantas} de limpieza que habías tomado con el formulario anterior no se pudieron recuperar: ` +
      `${motivos.join(", y ")}. Siguen guardadas, pero no se aplican a la base.`,
  };
}

export type HierarchyDecisionRow = {
  trigger: string;
  required: string;
};

// =============================================================================
// Helpers puros
// =============================================================================
export function buildChoiceOptions(drill: InstrumentoDrillResult | null, variable: string): ChoiceOption[] {
  if (!drill || !variable) return [];
  const rawLabels = drill.regla.value_labels?.[variable] ?? null;
  const counts = countChoiceValues(drill, variable);
  const options: ChoiceOption[] = [];

  if (rawLabels && typeof rawLabels === "object") {
    for (const [code, rawLabel] of Object.entries(rawLabels)) {
      const cleanCode = String(code).trim();
      if (!cleanCode) continue;
      const label = String(rawLabel ?? cleanCode).trim() || cleanCode;
      options.push({ code: cleanCode, label, n: counts.get(cleanCode) ?? null });
    }
  }

  if (!options.length) {
    for (const code of Array.from(counts.keys()).sort(naturalCodeSort)) {
      options.push({ code, label: code, n: counts.get(code) ?? null });
    }
  }

  return options;
}

export function countChoiceValues(drill: InstrumentoDrillResult, variable: string) {
  const counts = new Map<string, number>();
  for (const row of drill.casos ?? []) {
    const value = row[variable];
    for (const code of tokenizeSelectMultipleValue(value)) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    const labels = drill.regla.value_labels?.[variable] ?? {};
    for (const code of Object.keys(labels)) {
      const dummy = row[`${variable}.${code}`] ?? row[`${variable}_${code}`];
      if (isTruthyDummy(dummy)) counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return counts;
}

export function tokenizeSelectMultipleValue(value: unknown) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return uniqueStrings(value.map((item) => String(item)));
  return uniqueStrings(String(value).split(/[\s,;|]+/).map((item) => item.trim()));
}

export function isTruthyDummy(value: unknown) {
  if (value === true) return true;
  if (typeof value === "number") return value === 1;
  const text = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "t", "yes", "y", "si", "sí", "x"].includes(text);
}

export function naturalCodeSort(a: string, b: string) {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}

export function choiceOptionLabel(code: string, optionsByCode: Map<string, ChoiceOption>, fallback: string) {
  const clean = code.trim();
  if (!clean) return fallback;
  const option = optionsByCode.get(clean);
  if (!option) return clean;
  return option.label || option.code;
}

export function choiceOptionsLabel(codes: string[], optionsByCode: Map<string, ChoiceOption>, fallback: string) {
  const labels = codes
    .map((code) => choiceOptionLabel(code, optionsByCode, ""))
    .filter(Boolean);
  return labels.length ? labels.join(", ") : fallback;
}

export function decisionProcedureText(form: EditorForm, optionsByCode: Map<string, ChoiceOption>) {
  if (form.action_type === "complete_select_multiple_hierarchy") {
    const parsed = parseHierarchyMap(form.hierarchy_map_json);
    if (!parsed.ok || !Object.keys(parsed.value).length) return "Define qué opciones deben completarse.";
    const bits = Object.entries(parsed.value).map(([trigger, required]) => {
      const triggerLabel = choiceOptionLabel(trigger, optionsByCode, trigger);
      const requiredLabel = choiceOptionsLabel(required, optionsByCode, required.join(", "));
      return `${triggerLabel} → ${requiredLabel}`;
    });
    return `Relación: ${bits.join("; ")}`;
  }
  if (form.action_type === "adjust_select_multiple") {
    const add = parseLineList(form.sm_add_codes);
    const remove = parseLineList(form.sm_remove_codes);
    const parts = [];
    if (add.length) parts.push(`agregar ${choiceOptionsLabel(add, optionsByCode, add.join(", "))}`);
    if (remove.length) parts.push(`quitar ${choiceOptionsLabel(remove, optionsByCode, remove.join(", "))}`);
    return parts.length ? `Ajuste: ${parts.join("; ")}.` : "Define opciones para agregar o quitar.";
  }
  if (form.action_type === "nullify_fields") return "Los campos quedarán vacíos para los registros cubiertos.";
  if (form.action_type === "exclude_cases") return "Los registros cubiertos quedarán fuera de la base final.";
  return "";
}

/**
 * Una decisión caso por caso que incluye filas sin id de caso no se puede
 * guardar: el motor no sabría a qué fila llega. Sobre todos los casos de la
 * regla sí, porque el motor los resuelve él.
 */
export function avisoDeCasosSinId(form: EditorForm): string | null {
  if (form.action_type === "ignore_rule" || form.use_all_cases) return null;
  const sinId = form.target_case_ids.filter(esFilaSinId).length;
  if (sinId === 0) return null;
  return sinId === 1
    ? "1 caso elegido no tiene identificador en la auditoría y no se puede decidir por separado. Quítalo o decide sobre todos los casos de la regla."
    : `${sinId} casos elegidos no tienen identificador en la auditoría y no se pueden decidir por separado. Quítalos o decide sobre todos los casos de la regla.`;
}

export function getDecisionReadiness(form: EditorForm): DecisionReadiness {
  const issues: string[] = [];
  const avisoSinId = avisoDeCasosSinId(form);
  if (avisoSinId) issues.push(avisoSinId);
  if (form.action_type !== "ignore_rule" && form.scope_mode === "single" && form.target_case_ids.length !== 1) {
    issues.push("Selecciona un registro para guardar una decisión uno por uno.");
  } else if (form.action_type !== "ignore_rule" && !form.use_all_cases && form.target_case_ids.length === 0) {
    issues.push("Selecciona registros o cambia el alcance a Todos.");
  }
  if (actionNeedsVariable(form.action_type) && !form.target_variable) {
    issues.push("Selecciona una variable objetivo.");
  }
  if (form.action_type === "complete_select_multiple_hierarchy") {
    const parsed = parseHierarchyMap(form.hierarchy_map_json);
    if (!parsed.ok || Object.keys(parsed.value).length === 0) {
      issues.push("Define al menos una relación de opciones.");
    }
  }
  if (form.action_type === "adjust_select_multiple" && !parseLineList(form.sm_add_codes).length && !parseLineList(form.sm_remove_codes).length) {
    issues.push("Define al menos una opción para agregar o quitar.");
  }
  if (form.action_type === "replace_value" && !form.replace_to.trim()) {
    issues.push("Indica el valor corregido.");
  }
  if (form.action_type === "set_value" && !form.set_value.trim()) {
    issues.push("Indica el valor a asignar.");
  }
  if (form.action_type === "recode_map") {
    const parsed = parseJsonObject(form.recode_map_json, "El mapa de recodificación debe ser JSON válido.");
    if (!parsed.ok || Object.keys(parsed.value).length === 0) issues.push("Define el mapa de recodificación.");
  }
  if (!form.rationale.trim()) {
    issues.push("Escribe una justificación para dejar la decisión lista.");
  }
  return { ready: issues.length === 0, issues };
}

export function emptyEditorForm(): EditorForm {
  return {
    id: "",
    source_type: "instrument_rule",
    action_type: "ignore_rule",
    target_variable: "",
    rationale: "",
    scope_mode: "all",
    use_all_cases: true,
    target_case_ids: [],
    replace_from: "",
    replace_to: "",
    normalize_from: "",
    normalize_to: "",
    hierarchy_map_json: "",
    set_value: "",
    recode_map_json: "",
    nullify_variables_text: "",
    sm_add_codes: "",
    sm_remove_codes: "",
    impute_method: "fixed",
    impute_fixed_value: "",
  };
}

export function buildEditorForm(
  sourceId: string,
  item: LimpiezaQueueItem | null,
  decision: LimpiezaDecision | null,
  variableOptions: string[],
): EditorForm {
  const actionType = decision?.action_type ?? normalizePlannedAction(item?.planned_action_type);
  const plannedScope = normalizePlannedScope(item?.recommended_scope, actionType);
  const scopeMode = decision ? decisionScopeMode(decision) : plannedScope;
  const useAllCases = decision
    ? (decision.target_case_ids?.length ?? 0) === 0
    : actionType === "ignore_rule" || scopeMode === "all";
  const plannedParams = item?.planned_action_params ?? {};
  return {
    id: decision?.id ?? "",
    source_type: decision?.source_type ?? item?.source_type ?? inferSourceType(sourceId),
    action_type: actionType,
    target_variable: decision?.target_variable ?? (actionNeedsVariable(actionType) ? variableOptions[0] ?? "" : ""),
    rationale: decision?.rationale ?? "",
    scope_mode: actionType === "ignore_rule" ? "all" : scopeMode,
    use_all_cases: actionType === "ignore_rule" ? true : useAllCases,
    target_case_ids: decision?.target_case_ids ?? [],
    replace_from: readActionParam(decision, "from_value"),
    replace_to: readActionParam(decision, "to_value"),
    normalize_from: readActionParam(decision, "from_value"),
    normalize_to: readActionParam(decision, "normalized_value") || readActionParam(decision, "to_value"),
    hierarchy_map_json: readHierarchyMapParam(decision) || readHierarchyMapParamFromParams(plannedParams),
    set_value: readActionParam(decision, "value") || readActionParam(decision, "to_value"),
    recode_map_json: readObjectParam(decision, "recode_map") || readObjectParam(decision, "map") || readObjectFromParams(plannedParams, "recode_map"),
    nullify_variables_text: readListParam(decision, "target_variables") || readListFromParams(plannedParams, "target_variables"),
    sm_add_codes: readListParam(decision, "add_codes") || readListFromParams(plannedParams, "add_codes"),
    sm_remove_codes: readListParam(decision, "remove_codes") || readListFromParams(plannedParams, "remove_codes"),
    impute_method: readImputeMethod(decision),
    impute_fixed_value: readActionParam(decision, "fixed_value") || readActionParam(decision, "value"),
  };
}

export function buildDecisionPayload({
  form,
  status,
  sourceId,
  sourceType,
}: {
  form: EditorForm;
  status: "draft" | "ready";
  sourceId: string;
  sourceType: LimpiezaDecision["source_type"];
}) {
  if (status === "ready" && !form.rationale.trim()) {
    throw new Error("Escribe una justificación para dejar la decisión lista.");
  }

  if (actionNeedsVariable(form.action_type) && !form.target_variable) {
    throw new Error("Selecciona una variable objetivo.");
  }

  if (form.action_type !== "ignore_rule" && !form.use_all_cases && form.target_case_ids.length === 0) {
    throw new Error("Selecciona al menos un caso o marca que aplica a todos.");
  }

  const avisoSinId = avisoDeCasosSinId(form);
  if (avisoSinId) throw new Error(avisoSinId);

  if (form.action_type !== "ignore_rule" && form.scope_mode === "single" && form.target_case_ids.length !== 1) {
    throw new Error("Para revisar uno por uno, selecciona exactamente un registro.");
  }

  const actionParams: Record<string, unknown> = {};

  if (form.action_type === "replace_value") {
    if (!form.replace_to.trim()) {
      throw new Error("Indica el valor corregido.");
    }
    if (form.replace_from.trim()) actionParams.from_value = form.replace_from.trim();
    actionParams.to_value = form.replace_to.trim();
  }

  if (form.action_type === "set_value") {
    if (!form.set_value.trim()) {
      throw new Error("Indica el valor a asignar.");
    }
    actionParams.value = form.set_value.trim();
  }

  if (form.action_type === "recode_map") {
    const parsed = parseJsonObject(form.recode_map_json, "El mapa de recodificación debe ser JSON válido.");
    if (!parsed.ok) throw new Error(parsed.error);
    if (Object.keys(parsed.value).length === 0) {
      throw new Error("Define al menos una recodificación.");
    }
    actionParams.recode_map = parsed.value;
  }

  if (form.action_type === "nullify_fields") {
    const variables = parseLineList(form.nullify_variables_text);
    if (variables.length) actionParams.target_variables = variables;
  }

  if (form.action_type === "normalize_value") {
    if (!form.normalize_to.trim()) {
      throw new Error("Indica la etiqueta estándar.");
    }
    if (form.normalize_from.trim()) actionParams.from_value = form.normalize_from.trim();
    actionParams.normalized_value = form.normalize_to.trim();
  }

  if (form.action_type === "impute_value") {
    actionParams.method = form.impute_method;
    if (form.impute_method === "fixed") {
      if (!form.impute_fixed_value.trim()) {
        throw new Error("Escribe el valor fijo de imputación.");
      }
      actionParams.fixed_value = form.impute_fixed_value.trim();
    }
  }

  if (form.action_type === "complete_select_multiple_hierarchy") {
    const parsed = parseHierarchyMap(form.hierarchy_map_json);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    if (Object.keys(parsed.value).length === 0) {
      throw new Error("Define al menos una opción activadora en el mapa manual.");
    }
    actionParams.hierarchy_map = parsed.value;
  }

  if (form.action_type === "adjust_select_multiple") {
    const addCodes = parseLineList(form.sm_add_codes);
    const removeCodes = parseLineList(form.sm_remove_codes);
    if (!addCodes.length && !removeCodes.length) {
      throw new Error("Define al menos una opción para agregar o quitar.");
    }
    if (addCodes.length) actionParams.add_codes = addCodes;
    if (removeCodes.length) actionParams.remove_codes = removeCodes;
  }

  const scope: LimpiezaDecision["scope"] =
    form.action_type === "ignore_rule"
      ? "rule"
      : form.action_type === "exclude_cases"
        ? "case_subset"
        : form.use_all_cases
          ? "variable"
          : "cell_subset";

  return {
    ...(form.id ? { id: form.id } : {}),
    source_id: sourceId,
    source_type: sourceType,
    scope,
    target_case_ids: form.use_all_cases ? [] : form.target_case_ids,
    target_variable: actionNeedsVariable(form.action_type) ? form.target_variable : undefined,
    action_type: form.action_type,
    action_params: actionParams,
    rationale: form.rationale.trim(),
    status,
  };
}

export function buildCaseRows(drill: InstrumentoDrillResult | null, item: LimpiezaQueueItem | null): CaseRow[] {
  if (!drill) return [];
  const preferredKeys = uniqueStrings([...(item?.variables ?? []), ...(drill.regla.variables ?? [])]);
  const ids = normalizarCaseIds(drill.case_ids);
  return (drill.casos ?? []).map((raw, index) => {
    // Sin id (null, o una lista más corta que `casos`) no se inventa uno.
    const caseId = ids[index] ?? null;
    return {
      id: caseId ?? claveDeFilaSinId(index + 1),
      seleccionable: caseId !== null,
      raw,
      summary: buildCaseSummary(raw, preferredKeys),
    };
  });
}

export function buildCaseSummary(row: Record<string, unknown>, preferredKeys: string[]) {
  const candidateKeys = uniqueStrings([
    ...preferredKeys,
    ...Object.keys(row).filter((key) => !isSystemColumn(key)),
  ]).slice(0, 3);
  const bits = candidateKeys
    .map((key) => {
      const value = row[key];
      if (value == null || value === "") return null;
      return `${key}: ${stringifyCellValue(value)}`;
    })
    .filter((value): value is string => !!value);
  return bits.join(" | ");
}

export function actionNeedsVariable(actionType: LimpiezaDecisionActionType) {
  return (
    actionType === "replace_value" ||
    actionType === "set_value" ||
    actionType === "recode_map" ||
    actionType === "nullify_fields" ||
    actionType === "normalize_value" ||
    actionType === "impute_value" ||
    actionType === "complete_select_multiple_hierarchy" ||
    actionType === "adjust_select_multiple"
  );
}

export function normalizePlannedAction(value: unknown): LimpiezaDecisionActionType {
  const raw = String(value ?? "");
  return ACTION_OPTIONS.some((option) => option.value === raw)
    ? (raw as LimpiezaDecisionActionType)
    : "ignore_rule";
}

export function normalizePlannedScope(
  value: unknown,
  actionType: LimpiezaDecisionActionType,
): ReglaTreatmentScope {
  if (actionType === "ignore_rule") return "all";
  const raw = String(value ?? "");
  if (raw === "all" || raw === "selected" || raw === "single") return raw;
  return actionType === "exclude_cases" ? "selected" : "all";
}

export function decisionScopeMode(decision: LimpiezaDecision): ReglaTreatmentScope {
  const n = decision.target_case_ids?.length ?? 0;
  if (n === 0) return "all";
  if (n === 1) return "single";
  return "selected";
}

export function readActionParam(decision: LimpiezaDecision | null, key: string) {
  const value = decision?.action_params?.[key];
  return value == null ? "" : String(value);
}

export function readObjectParam(decision: LimpiezaDecision | null, key: string) {
  const value = decision?.action_params?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return JSON.stringify(value, null, 2);
}

export function readListParam(decision: LimpiezaDecision | null, key: string) {
  const value = decision?.action_params?.[key];
  if (Array.isArray(value)) return value.map((item) => String(item)).join("\n");
  if (typeof value === "string") return value;
  return "";
}

export function readObjectFromParams(params: Record<string, unknown>, key: string) {
  const value = params[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return JSON.stringify(value, null, 2);
}

export function readListFromParams(params: Record<string, unknown>, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value.map((item) => String(item)).join("\n");
  if (typeof value === "string") return value;
  return "";
}

export function readImputeMethod(decision: LimpiezaDecision | null): EditorForm["impute_method"] {
  const raw = String(decision?.action_params?.method ?? "fixed");
  if (raw === "mode" || raw === "median") return raw;
  return "fixed";
}

export function readHierarchyMapParam(decision: LimpiezaDecision | null) {
  const value = decision?.action_params?.hierarchy_map ?? decision?.action_params?.map;
  if (!value || typeof value !== "object") return "";
  return JSON.stringify(value, null, 2);
}

export function readHierarchyMapParamFromParams(params: Record<string, unknown>) {
  const value = params.hierarchy_map ?? params.map;
  if (!value || typeof value !== "object") return "";
  return JSON.stringify(value, null, 2);
}

export function hierarchyRowsFromDecisionText(text: string): HierarchyDecisionRow[] {
  const parsed = parseHierarchyMap(text);
  if (parsed.ok) {
    return Object.entries(parsed.value).map(([trigger, values]) => ({
      trigger,
      required: values.join("\n"),
    }));
  }
  return [{ trigger: "", required: "" }];
}

export function parseHierarchyMap(text: string): { ok: true; value: Record<string, string[]> } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Define el mapa manual de jerarquía." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "El mapa manual debe ser JSON válido." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "El mapa debe ser un objeto JSON con listas de códigos." };
  }
  const out: Record<string, string[]> = {};
  for (const [trigger, raw] of Object.entries(parsed as Record<string, unknown>)) {
    const key = trigger.trim();
    const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : [];
    const clean = values.map((value) => String(value).trim()).filter((value) => value && value !== key);
    if (key && clean.length) out[key] = Array.from(new Set(clean));
  }
  return { ok: true, value: out };
}

export function parseJsonObject(text: string, error: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "El valor debe ser un objeto JSON." };
  }
  return { ok: true, value: parsed as Record<string, unknown> };
}

export function parseLineList(text: string) {
  return uniqueStrings(text.split(/\r?\n|,/).map((value) => value.trim()));
}

export function isSelectMultipleItem(item?: LimpiezaQueueItem | null) {
  const tipoRegla = String(item?.tipo_regla ?? item?.tipo_observacion ?? "").toLowerCase();
  const tipoVariable = String(item?.tipo_variable ?? "").toLowerCase();
  return tipoRegla.includes("select_multiple") || tipoVariable.includes("select_multiple") || tipoVariable === "sm";
}

export function inferSourceType(sourceId: string): LimpiezaDecision["source_type"] {
  return sourceId.startsWith("RC_") ? "custom_rule" : "instrument_rule";
}

export function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (value == null ? "" : String(value).trim()))
        .filter((value) => !!value),
    ),
  );
}

export function isSystemColumn(key: string) {
  return key.startsWith("_") || key === ".__case_id__";
}

export function stringifyCellValue(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "number") return Number.isFinite(value) ? numberFormatter.format(value) : String(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

export function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateTimeFormatter.format(date);
}

export function humanizeAction(actionType?: LimpiezaDecisionActionType | null) {
  if (!actionType) return "Decisión";
  return actionOptionsFor(actionType).find((option) => option.value === actionType)?.label ?? "Decisión";
}
