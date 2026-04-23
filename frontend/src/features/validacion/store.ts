import { create } from "zustand";
import type { ValidacionTabId } from "./types";

// =============================================================================
// Store local de Fase 2 — Validación v2
// =============================================================================
// El estado "duro" (plan, evaluación, reglas custom) vive en el backend
// scoped por base. Acá guardamos solo el estado UI efímero:
//   - Pestaña activa.
//   - Base seleccionada arriba del todo (único selector de la página).
//   - Payloads de deep-link (prefill cuando se salta de un tab a otro
//     desde Limpieza y normalización: ej. "abrir la variable X en Explorar").
//   - Flag de loading genérico por pestaña.
//
// Lo importante: cambiar `baseNombre` debe invalidar cualquier caché
// local y forzar a las pestañas a refetch. Usamos un contador `version`
// para que los `useEffect([version])` de los tabs se disparen.

export type ValidacionPrefill = {
  limpieza?: Record<string, unknown>;
  // Para tab "instrumento": prefill de drill-down a una regla.
  instrumento?: { id_regla?: string };
  // Para tab "explorar": prefill de variable seleccionada (y opcional cruce).
  explorar?: { var?: string; cruzar_con?: string };
  // Para tab "reglas_custom": prefill del editor al crear/editar una regla.
  reglas_custom?: { tipo?: string; variables?: string[] };
};

type ValidacionState = {
  activeTab: ValidacionTabId;
  baseNombre: string | null;
  version: number; // bump al cambiar base — fuerza refetch en tabs
  prefill: ValidacionPrefill;

  setActiveTab: (tab: ValidacionTabId) => void;
  setBaseNombre: (nombre: string | null) => void;
  setPrefill: (tab: ValidacionTabId, payload: Record<string, unknown>) => void;
  clearPrefill: (tab: ValidacionTabId) => void;
  /** Deep-link: salta a otra pestaña y prefilea su slice de prefill. */
  jumpTo: (tab: ValidacionTabId, payload?: Record<string, unknown>) => void;
};

export const useValidacionStore = create<ValidacionState>((set) => ({
  activeTab: "explorar",
  baseNombre: null,
  version: 0,
  prefill: {},

  setActiveTab: (tab) => set({ activeTab: tab }),
  setBaseNombre: (nombre) =>
    set((s) => ({
      baseNombre: nombre,
      // Bump version para invalidar data cacheada en los tabs.
      version: s.version + 1,
      // Prefill se va con la base también — no tiene sentido preservar
      // un drill de regla X si cambiaste de base.
      prefill: {},
    })),
  setPrefill: (tab, payload) =>
    set((s) => ({
      prefill: { ...s.prefill, [tab]: payload },
    })),
  clearPrefill: (tab) =>
    set((s) => {
      const copy = { ...s.prefill };
      delete copy[tab];
      return { prefill: copy };
    }),
  jumpTo: (tab, payload) =>
    set((s) => ({
      activeTab: tab,
      prefill: payload ? { ...s.prefill, [tab]: payload } : s.prefill,
    })),
}));
