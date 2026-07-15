import type {
  ExploradorVariable,
  InstrumentoOperationalConfig,
} from "./types";

export const DEFAULT_OPERATIONAL_TIMEZONE = "America/Lima";
export const DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD = 0.9;
export const DEFAULT_DUPLICATE_MINIMUM_COVERAGE = 0.8;
export const MIN_DUPLICATE_COMPARISON_VARIABLES = 10;

export function defaultOperationalConfig(): InstrumentoOperationalConfig {
  return {
    version: 2,
    field_period: {
      enabled: false,
      variable: "",
      start_date: "",
      end_date: "",
      timezone: DEFAULT_OPERATIONAL_TIMEZONE,
    },
    duplicates: {
      enabled: false,
      variables: [],
      matching_method: "response_similarity",
      similarity_threshold: DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD,
      minimum_coverage: DEFAULT_DUPLICATE_MINIMUM_COVERAGE,
    },
  };
}

export function normalizeOperationalConfig(
  input?: Partial<InstrumentoOperationalConfig> | null,
): InstrumentoOperationalConfig {
  const defaults = defaultOperationalConfig();
  return {
    version: 2,
    field_period: {
      enabled: input?.field_period?.enabled === true,
      variable: cleanString(input?.field_period?.variable),
      start_date: cleanString(input?.field_period?.start_date),
      end_date: cleanString(input?.field_period?.end_date),
      timezone: cleanString(input?.field_period?.timezone) || defaults.field_period.timezone,
    },
    duplicates: {
      enabled: input?.duplicates?.enabled === true,
      variables: uniqueStrings(input?.duplicates?.variables),
      matching_method: "response_similarity",
      similarity_threshold: normalizeRatio(
        input?.duplicates?.similarity_threshold,
        defaults.duplicates.similarity_threshold,
      ),
      minimum_coverage: normalizeRatio(
        input?.duplicates?.minimum_coverage,
        defaults.duplicates.minimum_coverage,
      ),
    },
  };
}

export type OperationalValidationErrors = {
  field_period?: string;
  duplicates?: string;
};

export function validateOperationalConfig(
  config: InstrumentoOperationalConfig,
): OperationalValidationErrors {
  const errors: OperationalValidationErrors = {};
  if (config.field_period.enabled) {
    const period = config.field_period;
    if (!period.variable || !period.start_date || !period.end_date || !period.timezone) {
      errors.field_period = "Completa variable, inicio, cierre y zona horaria.";
    } else if (period.start_date > period.end_date) {
      errors.field_period = "El inicio del operativo no puede ser posterior al cierre.";
    } else if (!isValidTimeZone(period.timezone)) {
      errors.field_period = "La zona horaria no es válida. Usa un identificador como America/Lima.";
    }
  }
  if (config.duplicates.enabled) {
    const count = config.duplicates.variables.length;
    if (count < MIN_DUPLICATE_COMPARISON_VARIABLES) {
      errors.duplicates = `Elige al menos ${MIN_DUPLICATE_COMPARISON_VARIABLES} preguntas para comparar respuestas con suficiente precisión.`;
    } else if (
      config.duplicates.matching_method !== "response_similarity" ||
      !isRatio(config.duplicates.similarity_threshold) ||
      !isRatio(config.duplicates.minimum_coverage)
    ) {
      errors.duplicates = "La configuración de similitud no es válida.";
    }
  }
  return errors;
}

export function isOperationalConfigValid(config: InstrumentoOperationalConfig): boolean {
  return Object.keys(validateOperationalConfig(config)).length === 0;
}

export function operationalConfigFingerprint(config: InstrumentoOperationalConfig): string {
  const normalized = normalizeOperationalConfig(config);
  return JSON.stringify({
    ...normalized,
    duplicates: {
      ...normalized.duplicates,
      variables: [...normalized.duplicates.variables].sort(),
    },
  });
}

export function hasOperationalConfigChanges(
  draft: InstrumentoOperationalConfig,
  applied: InstrumentoOperationalConfig,
): boolean {
  return operationalConfigFingerprint(draft) !== operationalConfigFingerprint(applied);
}

export type OperationalStatusLabels = {
  fieldPeriod: string;
  duplicates: string;
};

export function buildOperationalStatusLabels(
  config: InstrumentoOperationalConfig,
): OperationalStatusLabels {
  return {
    fieldPeriod: config.field_period.enabled
      ? formatFieldPeriodLabel(config.field_period.start_date, config.field_period.end_date)
      : "Periodo",
    duplicates: config.duplicates.enabled
      ? `Similitud · ${formatPercent(config.duplicates.similarity_threshold)}`
      : "Duplicados",
  };
}

export type OperationalVariablePurpose = "period" | "duplicates";

export function rankOperationalVariables(
  variables: ExploradorVariable[],
  purpose: OperationalVariablePurpose,
): ExploradorVariable[] {
  return [...variables].sort((a, b) => {
    const scoreDiff = variableScore(b, purpose) - variableScore(a, purpose);
    if (scoreDiff !== 0) return scoreDiff;
    return a.name.localeCompare(b.name);
  });
}

export function isOperationalVariableSuggested(
  variable: ExploradorVariable,
  purpose: OperationalVariablePurpose,
): boolean {
  const text = `${variable.name} ${variable.label}`.toLowerCase();
  if (purpose === "period") {
    return variable.tipo === "fecha" || /fecha|date|inicio|start|fin|end|campo|entrevista/.test(text);
  }
  return false;
}

export type OperationalNarrative = {
  key: "field_period" | "duplicates";
  title: string;
  universe: string;
  variables: string;
  condition: string;
  violation: string;
  action: string;
};

export function buildOperationalNarratives(
  config: InstrumentoOperationalConfig,
): OperationalNarrative[] {
  const out: OperationalNarrative[] = [];
  if (config.field_period.enabled) {
    out.push({
      key: "field_period",
      title: "Fechas de campo",
      universe: "Encuestas incluidas después de retirar las pruebas.",
      variables: config.field_period.variable || "Variable pendiente",
      condition: `La fecha debe estar entre ${config.field_period.start_date || "inicio pendiente"} y ${config.field_period.end_date || "cierre pendiente"} (${config.field_period.timezone}).`,
      violation: "la fecha es anterior al inicio o posterior al cierre; los valores vacíos se revisan por separado.",
      action: "Revisar la fecha. La app no la reemplaza.",
    });
  }
  if (config.duplicates.enabled) {
    const questionCount = config.duplicates.variables.length;
    const threshold = formatPercent(config.duplicates.similarity_threshold);
    const coverage = formatPercent(config.duplicates.minimum_coverage);
    out.push({
      key: "duplicates",
      title: "Entrevistas con respuestas similares",
      universe: "Encuestas incluidas después de retirar las pruebas.",
      variables: questionCount > 0
        ? `${questionCount} preguntas: ${config.duplicates.variables.join(", ")}`
        : "Preguntas pendientes",
      condition: `Dos entrevistas se consideran similares cuando coinciden en al menos ${threshold} de las respuestas seleccionadas y existe información comparable en al menos ${coverage} de ellas.`,
      violation: "dos entrevistas alcanzan el porcentaje de coincidencia indicado; se muestran ambas entrevistas.",
      action: "Revisar el par y decidir si corresponde conservar o excluir una entrevista. La app no elimina ninguna.",
    });
  }
  return out;
}

function variableScore(variable: ExploradorVariable, purpose: OperationalVariablePurpose): number {
  const text = `${variable.name} ${variable.label}`.toLowerCase();
  const total = variable.n_validos + variable.n_nulos;
  const completeness = total > 0 ? variable.n_validos / total : 0;
  let score = completeness * 10;
  if (purpose === "period") {
    if (variable.tipo === "fecha") score += 100;
    if (/fecha|date|inicio|start|fin|end|campo|entrevista/.test(text)) score += 35;
  }
  return score;
}

function formatFieldPeriodLabel(startDate: string, endDate: string): string {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) return "Campo";

  if (start.year === end.year && start.month === end.month) {
    return `Campo · ${start.day}–${end.day} ${MONTHS_ES[start.month - 1]}`;
  }
  if (start.year === end.year) {
    return `Campo · ${start.day} ${MONTHS_ES[start.month - 1]}–${end.day} ${MONTHS_ES[end.month - 1]}`;
  }
  return `Campo · ${start.day} ${MONTHS_ES[start.month - 1]} ${start.year}–${end.day} ${MONTHS_ES[end.month - 1]} ${end.year}`;
}

const MONTHS_ES = [
  "ene.", "feb.", "mar.", "abr.", "may.", "jun.",
  "jul.", "ago.", "sept.", "oct.", "nov.", "dic.",
] as const;

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function normalizeRatio(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return isRatio(parsed) ? parsed : fallback;
}

function isRatio(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 1;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanString).filter(Boolean))];
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("es-PE", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
