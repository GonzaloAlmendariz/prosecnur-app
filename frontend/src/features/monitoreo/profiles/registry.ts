import type { MonitoreoFamilyId, MonitoreoFamilyModule } from "./types";

const LEGACY_PAGE_LOADER: MonitoreoFamilyModule["loadPage"] = () => import("virtual:monitoreo-page");

const FAMILY_PROFILES = {
  acreditacion: {
    family: "acreditacion",
    chunk: "monitoreo-original",
    label: "Acreditacion",
    views: ["fuentes", "modelo", "consultas", "telefonico", "avance"],
    loadPage: LEGACY_PAGE_LOADER,
    warmupScopes: ["source", "advance_summary", "queries_summary"],
    reportScopes: {
      fuentes: "source",
      consultas: "queries_summary",
      telefonico: "advance_summary",
      avance: "advance_summary",
    },
  },
  territorial: {
    family: "territorial",
    chunk: "monitoreo-original",
    label: "Territorial",
    views: ["fuentes", "modelo", "calidad", "consultas", "avance", "ocurrencias"],
    loadPage: LEGACY_PAGE_LOADER,
    warmupScopes: ["source", "route_summary", "validation_summary", "advance_summary", "queries_summary"],
    reportScopes: {
      fuentes: "source",
      modelo: "route_summary",
      avance: "advance_summary",
      calidad: "validation_summary",
      consultas: "queries_summary",
      ocurrencias: "queries_summary",
    },
  },
  aulas_universitarias: {
    family: "aulas_universitarias",
    chunk: "monitoreo-original",
    label: "Aulas universitarias",
    views: ["fuentes", "modelo", "avance", "calidad", "consultas"],
    loadPage: LEGACY_PAGE_LOADER,
    warmupScopes: ["source", "advance_summary", "validation_summary", "queries_summary"],
    reportScopes: {
      fuentes: "source",
      modelo: "source",
      avance: "advance_summary",
      calidad: "validation_summary",
      consultas: "queries_summary",
    },
  },
} satisfies Record<MonitoreoFamilyId, MonitoreoFamilyModule>;

export function normalizeMonitoreoFamily(value: unknown): MonitoreoFamilyId | null {
  if (value === "acreditacion" || value === "territorial" || value === "aulas_universitarias") {
    return value;
  }
  return null;
}

export function monitoreoFamilyLoaders() {
  return FAMILY_PROFILES;
}

export async function preloadMonitoreoFamily(value: unknown): Promise<MonitoreoFamilyModule | null> {
  const family = normalizeMonitoreoFamily(value);
  if (!family) return null;
  return FAMILY_PROFILES[family];
}

export async function loadMonitoreoFamilyPage(value: unknown) {
  const module = await preloadMonitoreoFamily(value);
  if (!module) return null;
  return module.loadPage();
}
