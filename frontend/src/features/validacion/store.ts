import { create } from "zustand";
import type { ValidacionTabId } from "./types";
import type { RelationalRuleMeta, RelationalSummary } from "./relationalPlan";

// =============================================================================
// Store local de Fase 2 — Validación v2
// =============================================================================
// El estado "duro" (plan, evaluación, reglas custom) vive en el backend
// scoped por base. Acá guardamos solo el estado UI efímero:
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

// Captura del surfacing relacional del plan (Fase 4). El plan se anota con los
// flags relacionales al construirse (POST .../instrumento/plan), pero el
// dashboard de auditoría (resumen_tabla) no los trae. Cacheamos por base la
// metadata capturada para que el panel naranja de "coherencia relacional del
// repeat" y su encabezado sobrevivan al remontaje de la pestaña (los tabs se
// desmontan al cambiar). Es un cache de payload del backend, no estado duro:
// si no está (cold-open sin reconstruir el plan), el panel se degrada al
// derivado del resumen.
export type RelationalPlanCapture = {
  summary: RelationalSummary | null;
  metaById: Record<string, RelationalRuleMeta>;
};

const RELATIONAL_DEFAULT_KEY = "__default__";
export function relationalBaseKey(base: string | null): string {
  return base && base.trim() ? base : RELATIONAL_DEFAULT_KEY;
}

// La pestaña activa NO vive acá: la dice la URL (`?pestana=`), y el store sólo
// guarda lo que la dirección no puede cargar — la base, el prefill de un salto
// entre pestañas y el contador que invalida caches. Ver ./pestanaDireccionable.ts.
type ValidacionState = {
  baseNombre: string | null;
  version: number; // bump al cambiar base — fuerza refetch en tabs
  prefill: ValidacionPrefill;
  relationalPlan: Record<string, RelationalPlanCapture>;

  setBaseNombre: (nombre: string | null) => void;
  setPrefill: (tab: ValidacionTabId, payload: Record<string, unknown>) => void;
  clearPrefill: (tab: ValidacionTabId) => void;
  setRelationalPlan: (base: string | null, capture: RelationalPlanCapture) => void;
  bumpVersion: () => void;
  resetForSession: () => void;
};

export const useValidacionStore = create<ValidacionState>((set) => ({
  baseNombre: null,
  version: 0,
  prefill: {},
  relationalPlan: {},

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
  setRelationalPlan: (base, capture) =>
    set((s) => ({
      relationalPlan: { ...s.relationalPlan, [relationalBaseKey(base)]: capture },
    })),
  bumpVersion: () =>
    set((s) => ({
      version: s.version + 1,
    })),
  resetForSession: () =>
    set((s) => ({
      baseNombre: null,
      version: s.version + 1,
      prefill: {},
      relationalPlan: {},
    })),
}));
