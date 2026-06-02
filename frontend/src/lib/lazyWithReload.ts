import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import { note } from "./logSink";

type LazyModule<Props> = { default: ComponentType<Props> };

const RELOAD_STORAGE_PREFIX = "pulso.lazyImportReloaded.";
const RELOAD_QUERY_PARAM = "pulsoLazyReload";

const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Loading chunk \d+ failed/i,
  /ChunkLoadError/i,
];

export function isDynamicImportLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function lazyWithReload<Props>(
  importer: () => Promise<LazyModule<Props>>,
  moduleId: string,
): LazyExoticComponent<ComponentType<Props>> {
  return lazy(async () => {
    try {
      const mod = await importer();
      clearReloadMarker(moduleId);
      return mod;
    } catch (error) {
      if (isDynamicImportLoadError(error) && scheduleOneShotReload(moduleId)) {
        return new Promise<LazyModule<Props>>(() => {
          // Mantiene el Suspense montado mientras el navegador reemplaza la pagina.
        });
      }
      throw error;
    }
  });
}

function scheduleOneShotReload(moduleId: string): boolean {
  if (typeof window === "undefined") return false;

  const key = reloadStorageKey(moduleId);
  try {
    if (window.sessionStorage.getItem(key) === "1") return false;
    window.sessionStorage.setItem(key, "1");
  } catch {
    return false;
  }

  note(`Bundle frontend actualizado; recargando para cargar ${moduleId}.`, "warn");

  window.setTimeout(() => {
    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set(RELOAD_QUERY_PARAM, String(Date.now()));
      window.location.replace(nextUrl.toString());
    } catch {
      window.location.reload();
    }
  }, 0);

  return true;
}

function clearReloadMarker(moduleId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(reloadStorageKey(moduleId));
  } catch {
    // sessionStorage puede fallar en algunos contextos; no afecta el render.
  }
}

function reloadStorageKey(moduleId: string): string {
  return `${RELOAD_STORAGE_PREFIX}${moduleId}`;
}
