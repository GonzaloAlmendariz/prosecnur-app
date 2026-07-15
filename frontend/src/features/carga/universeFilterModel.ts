import type {
  CargaUniverseFilterConfig,
  CargaUniverseObservedValue,
  CargaUniverseSummary,
  CargaUniverseVariable,
} from "../../api/client";

export type UniverseClassification = "real" | "test" | "unclassified";

export function defaultUniverseFilterConfig(): CargaUniverseFilterConfig {
  return {
    version: 1,
    enabled: false,
    variable: "",
    real_values: [],
    test_values: [],
    missing_policy: "exclude",
    unassigned_policy: "unclassified",
  };
}

export function normalizeUniverseFilterConfig(
  input?: Partial<CargaUniverseFilterConfig> | null,
): CargaUniverseFilterConfig {
  const realValues = uniqueStrings(input?.real_values);
  const realSet = new Set(realValues);
  return {
    version: 1,
    enabled: input?.enabled === true,
    variable: cleanString(input?.variable),
    real_values: realValues,
    test_values: uniqueStrings(input?.test_values).filter((value) => !realSet.has(value)),
    missing_policy: "exclude",
    unassigned_policy: "unclassified",
  };
}

export function validateUniverseFilterConfig(config: CargaUniverseFilterConfig): string | null {
  if (!config.enabled) return null;
  if (!config.variable.trim()) return "Elige la variable que distingue entrevistas reales y de prueba.";
  if (config.real_values.length === 0) return "Clasifica al menos un valor como entrevista real.";
  const testSet = new Set(config.test_values);
  if (config.real_values.some((value) => testSet.has(value))) {
    return "Un valor no puede clasificarse a la vez como real y prueba.";
  }
  return null;
}

export function classifyUniverseValue(
  config: CargaUniverseFilterConfig,
  code: string,
): UniverseClassification {
  if (config.real_values.includes(code)) return "real";
  if (config.test_values.includes(code)) return "test";
  return "unclassified";
}

export function setUniverseValueClassification(
  config: CargaUniverseFilterConfig,
  code: string,
  classification: UniverseClassification,
): CargaUniverseFilterConfig {
  const normalizedCode = cleanString(code);
  const realValues = config.real_values.filter((value) => value !== normalizedCode);
  const testValues = config.test_values.filter((value) => value !== normalizedCode);
  return {
    ...config,
    real_values: classification === "real" ? [...realValues, normalizedCode] : realValues,
    test_values: classification === "test" ? [...testValues, normalizedCode] : testValues,
  };
}

export function summarizeUniverseValues(
  values: CargaUniverseObservedValue[],
  config: CargaUniverseFilterConfig,
): CargaUniverseSummary {
  return values.reduce<CargaUniverseSummary>((summary, value) => {
    const n = finiteCount(value.count);
    summary.total += n;
    if (!value.missing && config.real_values.includes(value.value)) summary.included += n;
    else if (!value.missing && config.test_values.includes(value.value)) summary.excluded_test += n;
    else summary.excluded_unclassified += n;
    return summary;
  }, emptyUniverseSummary());
}

export function emptyUniverseSummary(): CargaUniverseSummary {
  return { total: 0, included: 0, excluded_test: 0, excluded_unclassified: 0 };
}

export function normalizeUniverseSummary(
  input?: Partial<CargaUniverseSummary> | null,
): CargaUniverseSummary {
  return {
    total: finiteCount(input?.total),
    included: finiteCount(input?.included),
    excluded_test: finiteCount(input?.excluded_test),
    excluded_unclassified: finiteCount(input?.excluded_unclassified),
  };
}

export function universeFilterFingerprint(config: CargaUniverseFilterConfig): string {
  const normalized = normalizeUniverseFilterConfig(config);
  return JSON.stringify({
    ...normalized,
    real_values: [...normalized.real_values].sort(),
    test_values: [...normalized.test_values].sort(),
  });
}

export function hasUniverseFilterChanges(
  draft: CargaUniverseFilterConfig,
  applied: CargaUniverseFilterConfig,
) {
  return universeFilterFingerprint(draft) !== universeFilterFingerprint(applied);
}

export function rankUniverseVariables(variables: CargaUniverseVariable[]): CargaUniverseVariable[] {
  return [...variables].sort((a, b) => {
    const score = universeVariableScore(b) - universeVariableScore(a);
    return score || a.variable.localeCompare(b.variable, "es");
  });
}

export function isUniverseVariableSuggested(variable: CargaUniverseVariable): boolean {
  return /test|prueba|real|piloto|training|capacit/.test(variableText(variable));
}

function universeVariableScore(variable: CargaUniverseVariable): number {
  let score = 0;
  if (isUniverseVariableSuggested(variable)) score += 100;
  if (/select|choice|categor|so/.test(String(variable.type ?? "").toLowerCase())) score += 20;
  if (finiteCount(variable.n_distinct) > 0 && finiteCount(variable.n_distinct) <= 12) score += 10;
  return score;
}

function variableText(variable: CargaUniverseVariable) {
  return variable.variable.toLowerCase();
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanString).filter(Boolean))];
}

function finiteCount(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
