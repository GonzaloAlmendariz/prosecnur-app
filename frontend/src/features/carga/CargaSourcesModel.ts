import type { MultiBaseStrategy } from "./store";

export type ProcessingSourcesProfile = "multi_actor" | "telefonico" | "territorial";

type SourceInput = {
  nombre?: string;
  source_kind?: string | null;
  parent_base?: string | null;
};

type MonitoringProfileMetadata = {
  profile_family?: string | null;
  profile_variant?: string | null;
  accreditation_declared?: boolean | null;
};

export function normalizePlannedInputCount(
  strategy: MultiBaseStrategy,
  value: number,
): number {
  const maximum = strategy === "independent" ? 10 : 16;
  const numeric = Number.isFinite(value) ? Math.trunc(value) : 1;
  return Math.min(maximum, Math.max(1, numeric));
}

export function plannedResultBaseCount(
  strategy: MultiBaseStrategy,
  plannedInputCount: number,
): number {
  const inputs = normalizePlannedInputCount(strategy, plannedInputCount);
  return strategy === "integrated" ? 1 : inputs;
}

export function sourceInputCount(sources: SourceInput[]): number {
  return sources.filter((source) => (
    source.source_kind !== "kobo_repeat" && !source.parent_base
  )).length;
}

export function processingProfileFromMonitoring(
  metadata: MonitoringProfileMetadata | null | undefined,
): ProcessingSourcesProfile | null {
  const family = String(metadata?.profile_family ?? "").trim().toLowerCase();

  if (family === "acreditacion" && metadata?.accreditation_declared === true) {
    return "multi_actor";
  }
  if (family === "telefonico") return "telefonico";
  if (family === "territorial") return "territorial";
  return null;
}
