export const TERRITORIAL_DURATION_VERY_SHORT_SECONDS = 120;
export const TERRITORIAL_DURATION_SHORT_SECONDS = 300;

export type TerritorialDurationOperationalKey = "normal" | "corto" | "muy_corto";

export function territorialDurationOperationalStatusFromSeconds(seconds: number | null | undefined): TerritorialDurationOperationalKey {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "normal";
  if (seconds < TERRITORIAL_DURATION_VERY_SHORT_SECONDS) return "muy_corto";
  if (seconds < TERRITORIAL_DURATION_SHORT_SECONDS) return "corto";
  return "normal";
}

export function territorialDurationOperationalStatusFromValues(values: {
  seconds?: number | null;
  durationStatus?: unknown;
  durationOperationalStatus?: unknown;
  durationOperationalLabel?: unknown;
}): TerritorialDurationOperationalKey {
  if (values.seconds != null && Number.isFinite(values.seconds) && values.seconds >= 0) {
    return territorialDurationOperationalStatusFromSeconds(values.seconds);
  }
  for (const value of [values.durationOperationalStatus, values.durationOperationalLabel, values.durationStatus]) {
    const key = normalizeDurationKey(value);
    if (key === "muy corta" || key === "muy corto") return "muy_corto";
    if (key === "corta" || key === "corto") return "corto";
  }
  return "normal";
}

export function territorialDurationIsReviewStatus(status: TerritorialDurationOperationalKey) {
  return status === "corto" || status === "muy_corto";
}

export function territorialDurationReviewPriority(status: TerritorialDurationOperationalKey) {
  if (status === "muy_corto") return 0;
  if (status === "corto") return 1;
  return 2;
}

export function territorialDurationReviewReasonKey(status: TerritorialDurationOperationalKey) {
  if (status === "muy_corto") return "duracion_menor_2_min";
  if (status === "corto") return "duracion_menor_5_min";
  return "duracion_por_revisar";
}

function normalizeDurationKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}
