import { create } from "zustand";
import type { ExploradorVariablesList, InstrumentoOperationalConfig, ValidacionTabId } from "./types";
import type { RelationalRuleMeta, RelationalSummary } from "./relationalPlan";

// =============================================================================
// Store local de Fase 2 — Validación v2
// =============================================================================
// El estado "duro" (plan, evaluación, reglas custom) vive en el backend
// scoped por base. Acá guardamos solo el estado UI efímero:
//   - Base seleccionada arriba del todo (único selector de la página).
//   - Payloads de deep-link (prefill cuando se salta de un tab a otro
//     desde Hallazgos: ej. "abrir la variable X en Explorar").
//   - Flag de loading genérico por pestaña.
//
// Lo importante: cambiar `baseNombre` debe invalidar cualquier caché
// local y forzar a las pestañas a refetch. Usamos un contador `version`
// para que los `useEffect([version])` de los tabs se disparen.

// Las claves son las pestañas de hoy (rebanada V2 de P6): el drill de una
// regla, que antes iba a "instrumento", va a "hallazgos", donde vive su panel.
export type ValidacionPrefill = {
  // Para "hallazgos": abrir el panel de una regla (y de dónde se llegó).
  hallazgos?: { id_regla?: string } & Record<string, unknown>;
  // Para "explorar": prefill de variable seleccionada (y opcional cruce).
  explorar?: { var?: string; cruzar_con?: string };
  // Para "reglas": prefill del editor al crear/editar una regla.
  reglas?: { tipo?: string; variables?: string[] };
  cierre?: Record<string, unknown>;
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
  // Tras reconectar con una sesión nueva, la base activa puede llegar de R como algo que no es
  // texto (lista vacía o un vector); `.trim()` reventaba Hallazgos. Lo que no es texto no es base.
  return typeof base === "string" && base.trim() ? base : RELATIONAL_DEFAULT_KEY;
}

// La pestaña activa NO vive acá: la dice la URL (`?pestana=`), y el store sólo
// guarda lo que la dirección no puede cargar — la base, el prefill de un salto
// entre pestañas y el contador que invalida caches. Ver ./pestanaDireccionable.ts.
type ValidacionState = {
  baseNombre: string | null;
  version: number; // bump al cambiar base — fuerza refetch en tabs
  prefill: ValidacionPrefill;
  relationalPlan: Record<string, RelationalPlanCapture>;
  /**
   * Controles del operativo editados y todavía sin aplicar, por base. Se
   * editan en Reglas y bloquean la auditoría en Hallazgos (rebanada V2 de P6):
   * por eso viven aquí y no en el estado del hook, que se desmonta al cambiar
   * de pestaña. Se borran al aplicar (reconstruir el plan).
   */
  controlesSinAplicar: Record<string, InstrumentoOperationalConfig>;
  /**
   * El inventario de variables de la base, pedido una vez por base y versión
   * y compartido por los controles del operativo y las reglas propias.
   */
  inventario: { clave: string; promesa: Promise<ExploradorVariablesList> } | null;

  setBaseNombre: (nombre: string | null) => void;
  setPrefill: (tab: ValidacionTabId, payload: Record<string, unknown>) => void;
  clearPrefill: (tab: ValidacionTabId) => void;
  setRelationalPlan: (base: string | null, capture: RelationalPlanCapture) => void;
  setControlesSinAplicar: (base: string | null, config: InstrumentoOperationalConfig | null) => void;
  setInventario: (inventario: ValidacionState["inventario"]) => void;
  bumpVersion: () => void;
  resetForSession: () => void;
};

export const useValidacionStore = create<ValidacionState>((set) => ({
  baseNombre: null,
  version: 0,
  prefill: {},
  relationalPlan: {},
  controlesSinAplicar: {},
  inventario: null,

  setBaseNombre: (nombre) =>
    set((s) => ({
      baseNombre: nombre,
      // Bump version para invalidar data cacheada en los tabs.
      version: s.version + 1,
      // Prefill se va con la base también — no tiene sentido preservar
      // un drill de regla X si cambiaste de base. Resolver la base por primera
      // vez (o repetirla) no es un cambio: un enlace que dejó su prefill antes
      // de abrir Validación lo conserva hasta que la pestaña lo consuma.
      prefill: s.baseNombre === null || s.baseNombre === nombre ? s.prefill : {},
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
  setControlesSinAplicar: (base, config) =>
    set((s) => {
      const copia = { ...s.controlesSinAplicar };
      if (config) copia[relationalBaseKey(base)] = config;
      else delete copia[relationalBaseKey(base)];
      return { controlesSinAplicar: copia };
    }),
  setInventario: (inventario) => set({ inventario }),
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
      controlesSinAplicar: {},
      inventario: null,
    })),
}));
