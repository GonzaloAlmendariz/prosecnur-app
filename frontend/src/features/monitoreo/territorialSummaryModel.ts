import type {
  MonitoreoTerritorialDashboard,
  TerritorialDistrictProgress,
  TerritorialResponseAuditRow,
} from "../../api/client";

export type TerritorialSummaryUmpStatus = "complete" | "incomplete" | "overfilled" | "none";

export type TerritorialSummaryDistrictRow = TerritorialDistrictProgress & {
  ump_complete: number;
  ump_started_incomplete: number;
  ump_overfilled: number;
  ump_no_progress: number;
};

export type TerritorialSummaryUmpRow = {
  key: string;
  district: string;
  ubigeo: string;
  ump: string;
  blockLabel: string;
  zone: string;
  valid: number;
  target: number;
  gap: number;
  progressPct: number | null;
  status: TerritorialSummaryUmpStatus;
  responsible: string;
};

export type TerritorialExecutiveDistributionStatus =
  | "ready"
  | "empty"
  | "missing_variable"
  | "missing_ranges";

export type TerritorialExecutiveDistributionItem = {
  key: string;
  label: string;
  value: number;
  pct: number;
  tone: "ready" | "base" | "muted";
};

export type TerritorialExecutiveDistribution = {
  status: TerritorialExecutiveDistributionStatus;
  message: string;
  total: number;
  variable: string;
  items: TerritorialExecutiveDistributionItem[];
};

export type TerritorialExecutiveUmpStack = {
  total: number;
  fulfilled: number;
  complete: number;
  overfilled: number;
  incomplete: number;
  none: number;
  segments: Array<{
    key: "fulfilled" | "incomplete" | "none";
    label: string;
    value: number;
    pct: number;
    tone: "ready" | "warning" | "muted";
  }>;
};

export type TerritorialExecutivePriorityAction =
  | { type: "district"; districtKey: string }
  | { type: "ump"; districtKey: string; umpKey: string };

export type TerritorialExecutivePriorityItem = {
  key: string;
  title: string;
  detail: string;
  value: number;
  target: number;
  gap: number;
  progressPct: number | null;
  tone: "warning" | "danger" | "base";
  action: TerritorialExecutivePriorityAction;
};

export type TerritorialExecutivePriorityGroup = {
  key: "districts" | "incomplete" | "near_complete" | "no_progress";
  label: string;
  emptyLabel: string;
  items: TerritorialExecutivePriorityItem[];
};

export type TerritorialExecutiveSummaryModel = {
  effectiveResponses: number;
  sex: TerritorialExecutiveDistribution;
  age: TerritorialExecutiveDistribution;
  ump: TerritorialExecutiveUmpStack;
  priorities: TerritorialExecutivePriorityGroup[];
};

export type TerritorialExecutiveSummaryInput = {
  reports: MonitoreoTerritorialDashboard;
  districtRows: TerritorialSummaryDistrictRow[];
  umpRows: TerritorialSummaryUmpRow[];
};

type EffectiveResponse = Partial<TerritorialResponseAuditRow>;

const EMPTY_LABEL = "Sin dato";

export function buildTerritorialExecutiveSummary({
  reports,
  districtRows,
  umpRows,
}: TerritorialExecutiveSummaryInput): TerritorialExecutiveSummaryModel {
  const effectiveRows = effectiveTerritorialResponses(reports);
  return {
    effectiveResponses: effectiveRows.length,
    sex: buildSexDistribution(reports, effectiveRows),
    age: buildAgeDistribution(reports, effectiveRows),
    ump: buildUmpStack(umpRows),
    priorities: buildTerritorialPriorityGroups(districtRows, umpRows),
  };
}

export function territorialDistrictActionKey(row: Pick<TerritorialSummaryDistrictRow, "ubigeo" | "distrito">) {
  return stringOrEmpty(row.ubigeo) || stringOrEmpty(row.distrito);
}

export function territorialUmpAction(row: Pick<TerritorialSummaryUmpRow, "key" | "ubigeo" | "district">): Extract<TerritorialExecutivePriorityAction, { type: "ump" }> {
  return {
    type: "ump",
    districtKey: stringOrEmpty(row.ubigeo) || stringOrEmpty(row.district),
    umpKey: stringOrEmpty(row.key),
  };
}

export function buildTerritorialPriorityGroups(
  districtRows: TerritorialSummaryDistrictRow[],
  umpRows: TerritorialSummaryUmpRow[],
): TerritorialExecutivePriorityGroup[] {
  const laggingDistricts = [...districtRows]
    .filter((row) => positiveNumber(row.brecha) > 0)
    .sort((a, b) => (
      (numberOrNull(a.avance_pct) ?? -1) - (numberOrNull(b.avance_pct) ?? -1)
      || positiveNumber(b.brecha) - positiveNumber(a.brecha)
      || stringOrEmpty(a.distrito).localeCompare(stringOrEmpty(b.distrito), "es-PE")
    ))
    .slice(0, 3)
    .map((row): TerritorialExecutivePriorityItem => ({
      key: `district:${territorialDistrictActionKey(row)}`,
      title: stringOrEmpty(row.distrito) || stringOrEmpty(row.ubigeo) || "Distrito sin nombre",
      detail: `${positiveNumber(row.validas)} / ${positiveNumber(row.meta)} válidas`,
      value: positiveNumber(row.validas),
      target: positiveNumber(row.meta),
      gap: positiveNumber(row.brecha),
      progressPct: numberOrNull(row.avance_pct),
      tone: positiveNumber(row.validas) === 0 ? "danger" : "warning",
      action: { type: "district", districtKey: territorialDistrictActionKey(row) },
    }));

  const incomplete = [...umpRows]
    .filter((row) => row.status === "incomplete" && positiveNumber(row.gap) > 2)
    .sort(compareUmpPriority)
    .slice(0, 4)
    .map((row) => umpPriorityItem(row, "warning"));

  const nearComplete = [...umpRows]
    .filter((row) => row.status === "incomplete" && positiveNumber(row.gap) > 0 && positiveNumber(row.gap) <= 2)
    .sort((a, b) => positiveNumber(a.gap) - positiveNumber(b.gap) || compareUmpPriority(a, b))
    .slice(0, 4)
    .map((row) => umpPriorityItem(row, "base"));

  const noProgress = [...umpRows]
    .filter((row) => row.status === "none")
    .sort((a, b) => (
      stringOrEmpty(a.district).localeCompare(stringOrEmpty(b.district), "es-PE")
      || compareUmpValue(a.ump, b.ump)
    ))
    .slice(0, 4)
    .map((row) => umpPriorityItem(row, "warning"));

  return [
    {
      key: "districts",
      label: "Distritos más rezagados",
      emptyLabel: "Sin distritos rezagados",
      items: laggingDistricts,
    },
    {
      key: "incomplete",
      label: "UMP iniciadas incompletas",
      emptyLabel: "Sin UMP iniciadas con brecha amplia",
      items: incomplete,
    },
    {
      key: "near_complete",
      label: "UMP cerca de completar",
      emptyLabel: "Sin UMP a una o dos válidas",
      items: nearComplete,
    },
    {
      key: "no_progress",
      label: "UMP sin avance",
      emptyLabel: "Sin UMP sin avance",
      items: noProgress,
    },
  ];
}

function buildUmpStack(rows: TerritorialSummaryUmpRow[]): TerritorialExecutiveUmpStack {
  const complete = rows.filter((row) => row.status === "complete").length;
  const overfilled = rows.filter((row) => row.status === "overfilled").length;
  const incomplete = rows.filter((row) => row.status === "incomplete").length;
  const none = rows.filter((row) => row.status === "none").length;
  const fulfilled = complete + overfilled;
  const total = Math.max(0, fulfilled + incomplete + none);
  return {
    total,
    fulfilled,
    complete,
    overfilled,
    incomplete,
    none,
    segments: [
      { key: "fulfilled", label: "Completas", value: fulfilled, pct: pct(fulfilled, total), tone: "ready" },
      { key: "incomplete", label: "Incompletas", value: incomplete, pct: pct(incomplete, total), tone: "warning" },
      { key: "none", label: "Sin avance", value: none, pct: pct(none, total), tone: "muted" },
    ],
  };
}

function buildSexDistribution(
  reports: MonitoreoTerritorialDashboard,
  rows: EffectiveResponse[],
): TerritorialExecutiveDistribution {
  const variables = reports.route_quota_progress?.variables;
  const variable = stringOrEmpty(variables?.sex_var);
  if (!variable) {
    return emptyDistribution("missing_variable", "Variable de sexo no configurada", variable);
  }

  const configuredLabels = collectQuotaLabels(reports, "sex").map(normalizeSexLabel);
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const label = normalizeSexLabel(row.sex);
    increment(counts, label || EMPTY_LABEL);
  });

  if (!rows.length) {
    return emptyDistribution("empty", "Sin respuestas válidas para distribuir por sexo", variable);
  }

  return {
    status: "ready",
    message: "Distribución por sexo sobre válidas que cuentan en avance",
    total: rows.length,
    variable,
    items: distributionItems(counts, rows.length, configuredLabels),
  };
}

function buildAgeDistribution(
  reports: MonitoreoTerritorialDashboard,
  rows: EffectiveResponse[],
): TerritorialExecutiveDistribution {
  const variables = reports.route_quota_progress?.variables;
  const variable = stringOrEmpty(variables?.age_var);
  if (!variable) {
    return emptyDistribution("missing_variable", "Variable de edad no configurada", variable);
  }
  const ageLabels = collectQuotaLabels(reports, "age");
  if (!ageLabels.length) {
    return emptyDistribution("missing_ranges", "Rangos de edad no configurados", variable);
  }
  if (!rows.length) {
    return {
      status: "empty",
      message: "Sin respuestas válidas para distribuir por edad",
      total: 0,
      variable,
      items: ageLabels.map((label) => ({ key: normalizeKey(label), label, value: 0, pct: 0, tone: "base" as const })),
    };
  }

  const counts = new Map<string, number>();
  const labelsByKey = new Map(ageLabels.map((label) => [normalizeKey(label), label]));
  rows.forEach((row) => {
    const age = numberOrNull(row.age);
    const label = age == null ? EMPTY_LABEL : ageLabelForValue(age, ageLabels) || EMPTY_LABEL;
    increment(counts, label);
    labelsByKey.set(normalizeKey(label), label);
  });

  return {
    status: "ready",
    message: "Distribución por edad sobre válidas que cuentan en avance",
    total: rows.length,
    variable,
    items: distributionItems(counts, rows.length, [...ageLabels, ...Array.from(labelsByKey.values())]),
  };
}

function effectiveTerritorialResponses(reports: MonitoreoTerritorialDashboard): EffectiveResponse[] {
  const sourceRows: EffectiveResponse[] = (reports.response_audit?.length ? reports.response_audit : reports.map?.points ?? []) as EffectiveResponse[];
  const byKey = new Map<string, EffectiveResponse>();
  sourceRows.forEach((row, index) => {
    if (row.advance_valid !== true) return;
    const key = stringOrEmpty(row.response_id) || `row:${row.row_index ?? index}`;
    byKey.set(key, { ...(byKey.get(key) ?? {}), ...row });
  });
  return Array.from(byKey.values());
}

function collectQuotaLabels(reports: MonitoreoTerritorialDashboard, kind: "sex" | "age") {
  const out: string[] = [];
  const add = (label: unknown) => {
    const value = stringOrEmpty(label);
    if (value && !out.some((item) => normalizeKey(item) === normalizeKey(value))) out.push(value);
  };
  (reports.route_quota_progress?.districts ?? []).forEach((row) => {
    (row[kind] ?? []).forEach((item) => add(item.label));
  });
  (reports.route_quota_progress?.blocks ?? []).forEach((row) => {
    (row[kind] ?? []).forEach((item) => add(item.label));
  });
  return out;
}

function distributionItems(counts: Map<string, number>, total: number, preferredOrder: string[]): TerritorialExecutiveDistributionItem[] {
  const orderedLabels: string[] = [];
  const addLabel = (label: string) => {
    const value = stringOrEmpty(label) || EMPTY_LABEL;
    if (!orderedLabels.some((item) => normalizeKey(item) === normalizeKey(value))) orderedLabels.push(value);
  };
  preferredOrder.forEach(addLabel);
  Array.from(counts.keys()).forEach(addLabel);
  return orderedLabels
    .map((label) => {
      const key = normalizeKey(label);
      const value = Array.from(counts.entries())
        .filter(([entry]) => normalizeKey(entry) === key)
        .reduce((sum, [, count]) => sum + count, 0);
      return {
        key,
        label,
        value,
        pct: pct(value, total),
        tone: label === EMPTY_LABEL ? "muted" as const : "base" as const,
      };
    })
    .filter((item) => item.value > 0 || preferredOrder.some((label) => normalizeKey(label) === item.key));
}

function emptyDistribution(
  status: TerritorialExecutiveDistributionStatus,
  message: string,
  variable: string,
): TerritorialExecutiveDistribution {
  return { status, message, total: 0, variable, items: [] };
}

function umpPriorityItem(row: TerritorialSummaryUmpRow, tone: "warning" | "base"): TerritorialExecutivePriorityItem {
  return {
    key: `ump:${row.key}`,
    title: `${row.district || "Sin distrito"} · ${row.ump || "UMP"}`,
    detail: `${positiveNumber(row.valid)} / ${positiveNumber(row.target)} válidas · ${row.responsible || "Sin responsable"}`,
    value: positiveNumber(row.valid),
    target: positiveNumber(row.target),
    gap: positiveNumber(row.gap),
    progressPct: numberOrNull(row.progressPct),
    tone,
    action: territorialUmpAction(row),
  };
}

function compareUmpPriority(a: TerritorialSummaryUmpRow, b: TerritorialSummaryUmpRow) {
  return (
    positiveNumber(b.gap) - positiveNumber(a.gap)
    || positiveNumber(a.progressPct) - positiveNumber(b.progressPct)
    || stringOrEmpty(a.district).localeCompare(stringOrEmpty(b.district), "es-PE")
    || compareUmpValue(a.ump, b.ump)
  );
}

function compareUmpValue(a: unknown, b: unknown) {
  const aNumber = firstNumber(a);
  const bNumber = firstNumber(b);
  if (aNumber !== bNumber) return aNumber - bNumber;
  return stringOrEmpty(a).localeCompare(stringOrEmpty(b), "es-PE", { numeric: true });
}

function firstNumber(value: unknown) {
  const match = stringOrEmpty(value).match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function ageLabelForValue(age: number, labels: string[]) {
  return labels.find((label) => {
    const bounds = parseAgeBounds(label);
    if (!bounds) return false;
    return age >= bounds.min && age <= bounds.max;
  }) ?? "";
}

function parseAgeBounds(label: string): { min: number; max: number } | null {
  const numbers = label.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [];
  if (!numbers.length) return null;
  if (numbers.length === 1) {
    const openEnded = /(?:\+|mas|más|a\s+mas|a\s+más|o\s+mas|o\s+más)/i.test(label);
    return { min: numbers[0], max: openEnded ? Number.POSITIVE_INFINITY : numbers[0] };
  }
  return { min: Math.min(numbers[0], numbers[1]), max: Math.max(numbers[0], numbers[1]) };
}

function normalizeSexLabel(value: unknown) {
  const raw = stringOrEmpty(value);
  const key = normalizeKey(raw);
  if (!key) return "";
  if (["h", "hom", "hombre", "male", "masculino", "varon"].includes(key)) return "Hombre";
  if (["m", "muj", "mujer", "female", "femenino"].includes(key)) return "Mujer";
  return titleCase(raw);
}

function titleCase(value: string) {
  return value
    .toLocaleLowerCase("es-PE")
    .replace(/(^|\s)\p{L}/gu, (match) => match.toLocaleUpperCase("es-PE"));
}

function increment(map: Map<string, number>, label: string) {
  map.set(label, (map.get(label) ?? 0) + 1);
}

function pct(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function positiveNumber(value: unknown) {
  return Math.max(0, Math.round(numberOrNull(value) ?? 0));
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function stringOrEmpty(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown) {
  return stringOrEmpty(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
