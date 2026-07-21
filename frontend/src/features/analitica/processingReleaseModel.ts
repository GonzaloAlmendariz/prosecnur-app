import type { ProcessingReleaseCatalog, ProcessingReleaseEntry } from "../../api/client";

export function processingReleaseActive(
  catalog: ProcessingReleaseCatalog | null,
  activeBase?: string | null,
): ProcessingReleaseEntry | null {
  if (!catalog) return null;
  const target = activeBase || catalog.active_base;
  return catalog.entries.find((entry) => entry.base === target) ?? catalog.entries[0] ?? null;
}

export function processingReleaseStatusView(status: string) {
  if (status === "approved") return { label: "Aprobada", tone: "success" as const };
  if (status === "stale") return { label: "Desactualizada", tone: "warning" as const };
  if (status === "ready") return { label: "Lista para aprobar", tone: "info" as const };
  return { label: "Pendiente", tone: "neutral" as const };
}

export function processingReleaseCounts(catalog: ProcessingReleaseCatalog | null) {
  const entries = catalog?.entries ?? [];
  return {
    total: entries.length,
    approved: entries.filter((entry) => entry.status === "approved").length,
    stale: entries.filter((entry) => entry.status === "stale").length,
    ready: entries.filter((entry) => entry.status === "ready").length,
  };
}
