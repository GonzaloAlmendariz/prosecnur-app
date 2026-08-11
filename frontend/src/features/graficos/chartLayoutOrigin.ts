export type ChartLayoutOrigin =
  | { kind: "base_ppt" }
  | { kind: "saved_style"; styleId: string; styleLabel: string }
  | { kind: "chart_adjustment" };

export type ChartLayoutOriginPresentation = {
  state: "base" | "mode" | "manual" | "unknown";
  label: string;
  detail: string;
  resetLabel: string;
  declared: boolean;
};

export function collectActiveChartStyleValues(
  slotArgs: Record<string, unknown> | null | undefined,
  visualArgNames: Iterable<string>,
): Record<string, unknown> {
  const args = asRecord(slotArgs);
  const nested = asRecord(args.overrides);
  const collected: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(nested)) {
    if (value === null || value === undefined) continue;
    collected[name] = value;
  }

  for (const name of visualArgNames) {
    if (Object.prototype.hasOwnProperty.call(collected, name)) continue;
    const value = args[name];
    if (value === null || value === undefined) continue;
    collected[name] = value;
  }

  return collected;
}

export function buildActiveChartStylePatch(
  slotArgs: Record<string, unknown> | null | undefined,
  visualArgNames: Iterable<string>,
  nextOverrides: Record<string, unknown>,
): Record<string, unknown> {
  const args = asRecord(slotArgs);
  const patch: Record<string, unknown> = { overrides: nextOverrides };

  for (const name of visualArgNames) {
    if (!Object.prototype.hasOwnProperty.call(args, name)) continue;
    if (args[name] === null || args[name] === undefined) continue;
    patch[name] = null;
  }

  return patch;
}

export function resolveActiveChartLayoutOrigin(
  overrides: Record<string, unknown> | null | undefined,
): ChartLayoutOrigin {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return { kind: "base_ppt" };
  }

  const hasOwnStyleValue = Object.values(overrides).some(
    (value) => value !== null && value !== undefined,
  );

  return hasOwnStyleValue
    ? { kind: "chart_adjustment" }
    : { kind: "base_ppt" };
}

export function presentChartLayoutOrigin(origin: unknown): ChartLayoutOriginPresentation {
  if (!origin || typeof origin !== "object" || Array.isArray(origin)) {
    return unknownOriginPresentation();
  }

  const candidate = origin as Record<string, unknown>;
  if (candidate.kind === "base_ppt") {
    return {
      state: "base",
      label: "Base PPT",
      detail: "Valores editables de la base PPT",
      resetLabel: "Restablecer Base PPT",
      declared: true,
    };
  }

  if (
    candidate.kind === "saved_style" &&
    typeof candidate.styleId === "string" &&
    candidate.styleId.trim().length > 0 &&
    typeof candidate.styleLabel === "string" &&
    candidate.styleLabel.trim().length > 0
  ) {
    return {
      state: "mode",
      label: `Estilo guardado: ${candidate.styleLabel.trim()}`,
      detail: "Valores editables de este estilo guardado",
      resetLabel: "Restablecer estilo guardado",
      declared: true,
    };
  }

  if (candidate.kind === "chart_adjustment") {
    return {
      state: "manual",
      label: "Ajuste de este gráfico",
      detail: "Copia propia de esta edición, sin vínculo con la biblioteca",
      resetLabel: "Quitar ajuste de este gráfico",
      declared: true,
    };
  }

  return unknownOriginPresentation();
}

function unknownOriginPresentation(): ChartLayoutOriginPresentation {
  return {
    state: "unknown",
    // Vocabulario del contrato interno asomando en la cara del analista. Lo que
    // necesita saber es que ese valor no se puede deshacer desde aquí.
    label: "Sin origen conocido",
    detail: "No se puede saber de dónde viene este valor",
    resetLabel: "No se puede restablecer",
    declared: false,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
