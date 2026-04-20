import { create } from "zustand";

// ----- Schema de configuración (v1) -----------------------------------------
// Toda la configuración del analista para Fase 4 vive en este objeto.
// Autosave debounced 2s → POST /api/analitica/config. Export/import vía JSON
// (mismo patrón que Fase 3 Codificación y Fase 5 Gráficos).

export type FuentePreferida = "auto" | "originales" | "adaptados";

export type SeccionConfig = {
  id: string;
  nombre: string;
  variables: string[];
  oculto: boolean;
  orden: number;
  // Cuando el analista renombra/reordena manualmente, marcamos manual:true
  // para que el "Detectar de nuevo" haga merge no-destructivo.
  manual?: boolean;
};

export type CodebookConfig = {
  codigos_solo_si_presentes: number[];
};

export type FrecuenciasConfig = {
  secciones_activas: string[];
  orden: "desc" | "asc" | "original";
  mostrar_todo: boolean;
  numericas_override?: string[];
};

export type SemaforoModo = "grupos" | "degradado_automatico" | "degradado_manual";

export type CrucesConfig = {
  cruces_vars: string[];
  modo: "estandar" | "dimensiones";
  show_sig: boolean;
  alpha: number;
  incluir_total: boolean;
  brecha: {
    filas: boolean;
    cols: boolean;
  };
  semaforo: {
    activo: boolean;
    cortes: number[];
    modo: SemaforoModo;
    colores?: { rojo: string; amarillo: string; verde: string };
  };
};

// Modalidad típica en Pulso: sólo 3 valores. La UI los ofrece como
// pills en el query builder, pero el schema acepta string libre para
// compat con proyectos que usen otras etiquetas.
export const MODALIDADES_PULSO = ["Presencial", "Telefónica", "Sin modalidad"] as const;
export type ModalidadValor = typeof MODALIDADES_PULSO[number] | string;

export type CondicionOperador = "==" | "!=" | "in" | "not_in";

export type CondicionRegla = {
  columna: string;
  operador: CondicionOperador;
  // Para `==` / `!=`: un solo valor. Para `in` / `not_in`: lista de valores.
  valor: string | string[];
};

// Cada regla es un conjunto de condiciones AND. Las reglas se evalúan
// en orden; la primera que matchea gana. El backend compila una
// `modalidad_fn` dinámica desde este schema.
// `patron` legacy se mantiene para retrocompatibilidad con proyectos
// exportados antes del rediseño de enumeradores.
export type ModalidadRegla = {
  id: string;
  condiciones: CondicionRegla[];
  modalidad: ModalidadValor;
  // Legacy (pre-rediseño): patrón glob contra el nombre del enumerador.
  // Si `condiciones` está vacío pero `patron` existe, se trata como
  // equivalente a [{columna: col_enumerador, operador: "==", valor: patron}].
  patron?: string;
};

export type EnumeradoresConfig = {
  col_enumerador: string;
  cols_corte: string[];
  col_modalidad?: string;
  modalidades_esperadas: string[];
  mostrar_vacias: boolean;
  titulo: string;
  min_encuestas: number;
  ordenar_por: "total" | "nombre";
  modalidad_reglas: ModalidadRegla[];
  modalidad_default: string;
};

export type AnaliticaConfig = {
  version: 1;
  fuente_preferida: FuentePreferida;
  secciones: SeccionConfig[];
  numericas: string[];
  codebook: CodebookConfig;
  frecuencias: FrecuenciasConfig;
  cruces: CrucesConfig;
  enumeradores: EnumeradoresConfig;
};

// ----- Defaults --------------------------------------------------------------

export const DEFAULT_CONFIG: AnaliticaConfig = {
  version: 1,
  fuente_preferida: "auto",
  secciones: [],
  numericas: [],
  codebook: {
    codigos_solo_si_presentes: [96, 97, 98, 99],
  },
  frecuencias: {
    secciones_activas: [],
    orden: "desc",
    mostrar_todo: false,
    numericas_override: undefined,
  },
  cruces: {
    cruces_vars: [],
    modo: "estandar",
    show_sig: true,
    alpha: 0.05,
    incluir_total: true,
    brecha: { filas: false, cols: false },
    semaforo: {
      activo: false,
      cortes: [50, 75],
      modo: "grupos",
      colores: { rojo: "#F8D7DA", amarillo: "#FFF3CD", verde: "#D4EDDA" },
    },
  },
  enumeradores: {
    col_enumerador: "Enumerator_name",
    cols_corte: [],
    col_modalidad: undefined,
    modalidades_esperadas: ["Presencial", "Telefónica"],
    mostrar_vacias: false,
    titulo: "Producción de Enumeradores",
    min_encuestas: 0,
    ordenar_por: "total",
    modalidad_reglas: [],
    modalidad_default: "Presencial",
  },
};

// ----- Store -----------------------------------------------------------------

type AnaliticaStore = {
  config: AnaliticaConfig;
  hydrated: boolean;
  dirty: boolean;

  // Hidratación desde backend — marca el snapshot como no dirty.
  hydrate: (c: AnaliticaConfig) => void;
  // Marca explícitamente limpio (tras autosave exitoso).
  markClean: () => void;
  // Reset completo a defaults (botón destructivo).
  reset: () => void;

  // Setters granulares — cada uno marca dirty para disparar autosave.
  setFuente: (f: FuentePreferida) => void;
  setSecciones: (s: SeccionConfig[]) => void;
  moveSeccion: (id: string, direction: "up" | "down") => void;
  renameSeccion: (id: string, nombre: string) => void;
  toggleSeccionOculto: (id: string) => void;
  setVariablesSeccion: (id: string, variables: string[]) => void;
  mergeSecciones: (sourceId: string, targetId: string) => void;

  setNumericas: (v: string[]) => void;

  setCodebook: (patch: Partial<CodebookConfig>) => void;
  setFrecuencias: (patch: Partial<FrecuenciasConfig>) => void;
  setCruces: (patch: Partial<CrucesConfig>) => void;
  setEnumeradores: (patch: Partial<EnumeradoresConfig>) => void;
};

function dirty(partial: Partial<AnaliticaStore>): Partial<AnaliticaStore> {
  return { ...partial, dirty: true };
}

export const useAnaliticaStore = create<AnaliticaStore>((set) => ({
  config: DEFAULT_CONFIG,
  hydrated: false,
  dirty: false,

  hydrate: (c) => set({ config: c, hydrated: true, dirty: false }),
  markClean: () => set({ dirty: false }),
  reset: () => set({ config: DEFAULT_CONFIG, dirty: true }),

  setFuente: (f) =>
    set((s) => dirty({ config: { ...s.config, fuente_preferida: f } })),

  setSecciones: (secciones) =>
    set((s) => dirty({ config: { ...s.config, secciones } })),

  moveSeccion: (id, direction) =>
    set((s) => {
      const list = [...s.config.secciones];
      const i = list.findIndex((x) => x.id === id);
      if (i < 0) return s;
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return s;
      [list[i], list[j]] = [list[j], list[i]];
      // reasignar `orden` para que el backend reciba posiciones consistentes.
      const normalized = list.map((x, idx) => ({ ...x, orden: idx, manual: true }));
      return { ...dirty({ config: { ...s.config, secciones: normalized } }) };
    }),

  renameSeccion: (id, nombre) =>
    set((s) => {
      const secciones = s.config.secciones.map((x) =>
        x.id === id ? { ...x, nombre, manual: true } : x,
      );
      return { ...dirty({ config: { ...s.config, secciones } }) };
    }),

  toggleSeccionOculto: (id) =>
    set((s) => {
      const secciones = s.config.secciones.map((x) =>
        x.id === id ? { ...x, oculto: !x.oculto, manual: true } : x,
      );
      return { ...dirty({ config: { ...s.config, secciones } }) };
    }),

  setVariablesSeccion: (id, variables) =>
    set((s) => {
      const secciones = s.config.secciones.map((x) =>
        x.id === id ? { ...x, variables, manual: true } : x,
      );
      return { ...dirty({ config: { ...s.config, secciones } }) };
    }),

  // Mueve todas las variables de `sourceId` al `targetId` y elimina la fuente.
  mergeSecciones: (sourceId, targetId) =>
    set((s) => {
      const source = s.config.secciones.find((x) => x.id === sourceId);
      const target = s.config.secciones.find((x) => x.id === targetId);
      if (!source || !target || sourceId === targetId) return s;
      const mergedVars = Array.from(new Set([...target.variables, ...source.variables]));
      const secciones = s.config.secciones
        .filter((x) => x.id !== sourceId)
        .map((x) => (x.id === targetId ? { ...x, variables: mergedVars, manual: true } : x));
      return { ...dirty({ config: { ...s.config, secciones } }) };
    }),

  setNumericas: (numericas) =>
    set((s) => dirty({ config: { ...s.config, numericas } })),

  setCodebook: (patch) =>
    set((s) => dirty({ config: { ...s.config, codebook: { ...s.config.codebook, ...patch } } })),

  setFrecuencias: (patch) =>
    set((s) => dirty({ config: { ...s.config, frecuencias: { ...s.config.frecuencias, ...patch } } })),

  setCruces: (patch) =>
    set((s) => dirty({ config: { ...s.config, cruces: { ...s.config.cruces, ...patch } } })),

  setEnumeradores: (patch) =>
    set((s) =>
      dirty({ config: { ...s.config, enumeradores: { ...s.config.enumeradores, ...patch } } }),
    ),
}));
