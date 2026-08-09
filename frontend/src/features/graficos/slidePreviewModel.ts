import type {
  GraficadorAuthoringMode,
  GraficadorCapabilityKey,
  GraficadorDataRequirement,
  GraficadorMetadata,
} from "../../api/client";

type DataArgs = Record<string, unknown>;

export type ResolvedGraficadorContract = {
  capabilityKey: GraficadorCapabilityKey;
  requirementLabel: string;
  authoringMode: GraficadorAuthoringMode;
  dataRequirement: GraficadorDataRequirement;
};

function isRecord(value: unknown): value is DataArgs {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isConfiguredRef(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasConfiguredVars(value: unknown): boolean {
  if (isConfiguredRef(value)) return true;

  if (Array.isArray(value)) {
    return value.some(isConfiguredRef);
  }

  if (!isRecord(value)) return false;
  const groups = Object.entries(value);
  return groups.length > 0 && groups.every(([name, refs]) => (
    name.trim().length > 0
    && (isConfiguredRef(refs) || (Array.isArray(refs) && refs.some(isConfiguredRef)))
  ));
}

function hasConfiguredNamedVars(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const groups = Object.entries(value);
  return groups.length > 0 && groups.every(([name, refs]) => (
    name.trim().length > 0
    && (isConfiguredRef(refs) || (Array.isArray(refs) && refs.some(isConfiguredRef)))
  ));
}

function hasConfiguredDirectDataArgs(args: DataArgs): boolean {
  return isConfiguredRef(args.var) || hasConfiguredVars(args.vars);
}

export function hasConfiguredChartDataArgs(
  value: unknown,
  requirement: GraficadorDataRequirement = "var_or_vars",
): boolean {
  if (requirement === "capability") return true;
  if (requirement === "unknown") return false;
  if (!isRecord(value)) return false;

  if (requirement === "named_vars") return hasConfiguredNamedVars(value.vars);

  if (value.modo !== "multilista") {
    return hasConfiguredDirectDataArgs(value);
  }

  if (!Array.isArray(value.bloques) || value.bloques.length === 0) return false;

  return value.bloques.every((block) => (
    isRecord(block)
    && block.modo !== "multilista"
    && hasConfiguredDirectDataArgs(block)
  ));
}

function legacyCapabilityKey(
  requisito: string | undefined,
  featureKind: string | undefined,
): GraficadorCapabilityKey {
  const legacyKeys = [requisito, featureKind]
    .map((value) => value?.trim().toLocaleLowerCase("es") ?? "");
  if (legacyKeys.some((value) => value === "dimensiones" || value === "dimensions")) {
    return "dimensions";
  }
  if (legacyKeys.includes("territorial_coverage")) return "territorial_coverage";
  return "";
}

export function resolveGraficadorContract(
  metadata: GraficadorMetadata | undefined,
): ResolvedGraficadorContract {
  const capabilityKey = metadata?.capability_key
    ?? legacyCapabilityKey(metadata?.requisito, metadata?.feature_kind);
  const requirementLabel = metadata?.requirement_label
    ?? metadata?.requisito?.trim()
    ?? "";
  const authoringMode = metadata?.authoring_mode ?? "direct";
  const dataRequirement = metadata?.data_requirement
    ?? (capabilityKey === "dimensions" || capabilityKey === "territorial_coverage"
      ? "capability"
      : "var_or_vars");
  return { capabilityKey, requirementLabel, authoringMode, dataRequirement };
}

export function chartDataPreflightIssue(
  args: unknown,
  metadata: GraficadorMetadata | undefined,
): string | null {
  const contract = resolveGraficadorContract(metadata);
  if (contract.authoringMode === "unknown" || contract.dataRequirement === "unknown") {
    return contract.requirementLabel || "el contrato de datos no es compatible con esta versión";
  }
  if (contract.capabilityKey === "unknown") {
    return contract.requirementLabel || "la capacidad requerida no es compatible con esta versión";
  }
  if (hasConfiguredChartDataArgs(args, contract.dataRequirement)) return null;
  if (contract.authoringMode === "generated" && contract.dataRequirement === "named_vars") {
    return "el plan no incluye las equivalencias nombradas que requiere este modelo y la biblioteca no puede completarlas";
  }
  if (contract.dataRequirement === "named_vars") {
    return "configura los grupos de variables con nombre en la pestaña Datos";
  }
  return "configura la variable principal en la pestaña Datos";
}
