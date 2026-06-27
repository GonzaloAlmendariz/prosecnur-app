import type { MonitoreoFamilyId, MonitoreoFamilyModule } from "./types";

type FamilyProfileModule = { default: MonitoreoFamilyModule };

const FAMILY_PROFILE_LOADERS: Record<MonitoreoFamilyId, () => Promise<FamilyProfileModule>> = {
  acreditacion: () => import("./acreditacion"),
  territorial: () => import("./territorial"),
  aulas_universitarias: () => import("./aulas"),
  telefonico: () => import("./telefonico"),
};

export function normalizeMonitoreoFamily(value: unknown): MonitoreoFamilyId | null {
  if (value === "acreditacion" || value === "territorial" || value === "aulas_universitarias" || value === "telefonico") {
    return value;
  }
  return null;
}

export function monitoreoFamilyLoaders() {
  return FAMILY_PROFILE_LOADERS;
}

export async function preloadMonitoreoFamily(value: unknown): Promise<MonitoreoFamilyModule | null> {
  const family = normalizeMonitoreoFamily(value);
  if (!family) return null;
  const module = await FAMILY_PROFILE_LOADERS[family]();
  return module.default;
}

export async function loadMonitoreoFamilyPage(value: unknown) {
  const module = await preloadMonitoreoFamily(value);
  if (!module) return null;
  return module.loadPage();
}
