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
  /llegó sin componente/i,
];

// Un archivo del build servido vacío (iCloud lo había desalojado, o una copia a
// medias) no hace fallar el import: resuelve a un módulo sin `default` y React
// cae en el error #306, que no dice qué archivo faltó. Se trata como un fallo de
// carga: una recarga y, si persiste, un error que nombra el módulo.
export function moduloConComponente<M extends { default?: unknown }>(mod: M | null | undefined, moduleId: string): M {
  const componente = mod?.default;
  if (typeof componente === "function" || (typeof componente === "object" && componente !== null)) return mod as M;
  throw new Error(`El módulo ${moduleId} llegó sin componente: el archivo del build está vacío o incompleto.`);
}

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
      const mod = moduloConComponente(await importer(), moduleId);
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

// Para los `import()` que no pasan por `lazy` (el shell de Monitoreo resuelve
// su perfil a mano): un build regenerado con la ventana abierta deja el índice
// apuntando a chunks que ya no existen. Recarga una vez; si vuelve a fallar,
// devuelve false y el llamador muestra el error.
export function recargarSiElBuildCambio(error: unknown, moduleId: string): boolean {
  return isDynamicImportLoadError(error) && scheduleOneShotReload(moduleId);
}

export function marcarCargaExitosa(moduleId: string): void {
  clearReloadMarker(moduleId);
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
