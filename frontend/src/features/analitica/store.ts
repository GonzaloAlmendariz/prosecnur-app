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
  incluir_titulos: boolean;
  incluir_secciones: boolean;
  numericas_override?: string[];
};

export type SemaforoModo = "grupos" | "degradado_automatico" | "degradado_manual";

// Cada variable de cruce puede tener una lista de categorías excluidas
// que aplican cuando la variable aparece como columna de cruce. Nota:
// prosecnur filtra globalmente las filas antes de generar las tablas,
// así que los valores excluidos tampoco aparecen cuando la variable es
// fila de otra tabla. La UI explica este trade-off.
export type CruceVarConfig = {
  name: string;
  excluidas?: string[];
};

export type CrucesConfig = {
  // Schema v2: lista de objetos. El store acepta legacy `string[]` y lo
  // convierte al montar (ver `normalizeCrucesVars`).
  cruces_vars: CruceVarConfig[];
  modo: "estandar" | "dimensiones";
  show_sig: boolean;
  alpha: number;
  incluir_total: boolean;
  incluir_titulos: boolean;
  incluir_secciones: boolean;
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

// ----- Dimensiones (tab Analítica → Dimensiones) ----------------------------
// Los "subindices" del paquete R se exponen en la UI como "bloques" porque es
// más intuitivo. La API conserva ambos términos. La pipeline es:
//   recodificar items 0-100 (listas_objetivo) →
//   subcriterios promediados (opcional) →
//   bloques (subindices) →
//   indices compuestos →
//   semáforo + paleta radar.

export type SubcriterioConfig = {
  // Nombre técnico de la nueva columna calculada (ej. "r100_p17_prom").
  nombre: string;
  // Etiqueta humana del subcriterio (ej. "Diligencia"). Usada en UI y
  // como label de la columna generada para que aparezca con nombre
  // humano en preview, cruces y dashboard. Si no se provee, el sistema
  // cae al `nombre` técnico.
  etiqueta?: string;
  // Columnas fuente cuyo promedio fila-a-fila genera `nombre`.
  fuente: string[];
};

export type BloqueConfig = {
  nombre: string;       // id interno (ej. "trato"). Crea col `sub_<nombre>`.
  etiqueta: string;     // título humano ("Trato").
  vars: string[];       // vars `r100_*` que componen el bloque.
};

export type IndiceConfig = {
  nombre: string;       // id interno (ej. "indice_general"). Crea `idx_<nombre>`.
  etiqueta: string;
  subindices: string[]; // nombres de bloques que componen este índice.
};

export type DimensionesSemaforo = {
  cortes: number[];     // [rojo→ámbar, ámbar→verde], 0-100.
  colores: { rojo: string; ambar: string; verde: string };
};

export type DimensionesConfig = {
  // Listas de respuestas tipo escala para identificar variables a recodificar.
  listas_objetivo: string[];
  // Vars excluidas explícitamente de la recodificación (ej. consent).
  excluir_vars: string[];
  // Override del orden ascendente por list_name. Vacío = usar orden del instrumento.
  orden_por_lista: Record<string, string[]>;
  codigos_missing: string[];                // global o {"_default": [...]}
  codigos_no_aplica: Record<string, string[]>;
  prefijo: string;                          // "r100_" por default.
  subcriterios: SubcriterioConfig[];
  subindices: BloqueConfig[];
  indices: IndiceConfig[];
  semaforo: DimensionesSemaforo;
  radar: { paleta: "okabe_ito" | "ipe"; min_ejes: number };
  labels_indices: Record<string, string>;
  labels_subindices: Record<string, string>;
  // Etiqueta humana corta por variable individual (ej. "r100_p12" →
  // "Respeto y amabilidad"). Equivalente a `labels_indicadores_tbl` del
  // qmd canónico. Se aplica como `attr(col, "label")` al construir, y
  // alimenta los títulos de gráficos/tablas en Cruces, Gráficos y
  // Dashboard. Si no hay entry para una var, se cae al label largo del
  // instrumento.
  labels_indicadores: Record<string, string>;
};

// ----- Bases -----------------------------------------------------------------
// El pane "Bases" expone 3 formatos independientes. Cada uno tiene su
// propio botón "Generar" y su propia sub-config. Evitamos un zip único
// para dar control granular y poder re-ejecutar solo lo que cambió.

// Cómo manejar las preguntas select_multiple al exportar:
// - "codigos_crudos"   → dejar "1 3 5" tal cual.
// - "etiquetas_unidas" → decodificar cada código y unir con " | ".
// - "dummy_01"         → expandir a columnas 0/1 (una por opción). Estándar
//                        en análisis estadístico.
export type MultiSelectMode = "codigos_crudos" | "etiquetas_unidas" | "dummy_01";

export type BasesSavConfig = {
  // Incluir un niveles_medida.sps como red de seguridad. Por defecto OFF:
  // el .sav lleva measure / format.spss / display_width embebidos. Activar
  // solo si tu SPSS pierde los atributos al abrir.
  incluir_sps: boolean;
};

export type BasesCsvConfig = {
  valores: "codigos" | "etiquetas";
  separador: "," | ";";
  multi_select: MultiSelectMode;
};

export type BasesXlsxConfig = {
  // "ambos" escribe dos hojas: `codigos` + `etiquetas`. Útil cuando el
  // archivo se comparte entre analistas (codigos) y stakeholders (etiquetas).
  valores: "codigos" | "etiquetas" | "ambos";
  multi_select: MultiSelectMode;
};

export type MeasureSpss = "nominal" | "ordinal" | "scale";

// Override por variable de la inferencia SPSS. `undefined` = dejar la
// inferencia. El usuario edita uno de estos cuando la auto-inferencia
// clasificó mal (p. ej. una Likert que quedó como nominal), o cuando
// quiere forzar un ancho específico en un texto libre.
export type BasesOverride = {
  measure?: MeasureSpss;
  format_spss?: string;
};

export type BasesConfig = {
  sav: BasesSavConfig;
  csv: BasesCsvConfig;
  xlsx: BasesXlsxConfig;
  // Clave = nombre técnico de la variable en rp_data. Solo afecta al
  // export .sav — CSV y XLSX ignoran measure/format.spss.
  overrides: Record<string, BasesOverride>;
};

export type AnaliticaConfig = {
  // v1 → v2: añadir `bases`. Migración no-destructiva en mergeWithDefaults.
  version: 2;
  fuente_preferida: FuentePreferida;
  secciones: SeccionConfig[];
  numericas: string[];
  // Variables que se excluyen globalmente de Codebook y Frecuencias.
  // No afecta a Cruces ni Enumeradores. La UI expone este bucket desde
  // ambos panes (Codebook y Frecuencias) para que el usuario pueda
  // sincronizar qué variables reporta en ambos sitios.
  variables_excluidas: string[];
  codebook: CodebookConfig;
  frecuencias: FrecuenciasConfig;
  cruces: CrucesConfig;
  enumeradores: EnumeradoresConfig;
  bases: BasesConfig;
  dimensiones: DimensionesConfig;
};

// ----- Defaults --------------------------------------------------------------

export const DEFAULT_CONFIG: AnaliticaConfig = {
  version: 2,
  fuente_preferida: "auto",
  secciones: [],
  numericas: [],
  variables_excluidas: [],
  codebook: {
    codigos_solo_si_presentes: [96, 97, 98, 99],
  },
  frecuencias: {
    secciones_activas: [],
    // Default "original": respeta el orden del instrumento. Más cómodo
    // para revisar la base con alguien que conoce el XLSForm.
    orden: "original",
    mostrar_todo: false,
    incluir_titulos: true,
    incluir_secciones: true,
    numericas_override: undefined,
  },
  cruces: {
    cruces_vars: [],
    modo: "estandar",
    show_sig: true,
    alpha: 0.05,
    incluir_total: true,
    incluir_titulos: true,
    incluir_secciones: true,
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
  bases: {
    sav:  { incluir_sps: false },
    csv:  { valores: "etiquetas", separador: ",", multi_select: "dummy_01" },
    xlsx: { valores: "ambos", multi_select: "dummy_01" },
    overrides: {},
  },
  dimensiones: {
    listas_objetivo: [
      "satisfaccion", "acuerdo", "oportunidad", "info_disponible",
      "flex_horario", "canales", "prioridad", "acceso_local", "senal",
      "si_parcial_no", "si_masmenos_no", "equip",
      "si_nosabe", "parcialnosabe", "masmenosnosabe",
      "recomendable", "recuerda_parcialnosabe", "recuerda_masmenosnosabe",
      "si_no",
    ],
    excluir_vars: ["consent"],
    orden_por_lista: {},
    codigos_missing: ["75", "88", "90"],
    codigos_no_aplica: {},
    prefijo: "r100_",
    subcriterios: [],
    subindices: [],
    indices: [],
    semaforo: {
      cortes: [60, 80],
      colores: { rojo: "#D84B55", ambar: "#E0B44C", verde: "#3A9A5B" },
    },
    radar: { paleta: "okabe_ito", min_ejes: 3 },
    labels_indices: {},
    labels_subindices: {},
    labels_indicadores: {},
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
  setVariablesExcluidas: (v: string[]) => void;
  toggleVariableExcluida: (name: string) => void;

  setCodebook: (patch: Partial<CodebookConfig>) => void;
  setFrecuencias: (patch: Partial<FrecuenciasConfig>) => void;
  setCruces: (patch: Partial<CrucesConfig>) => void;
  setEnumeradores: (patch: Partial<EnumeradoresConfig>) => void;

  setBasesSav: (patch: Partial<BasesSavConfig>) => void;
  setBasesCsv: (patch: Partial<BasesCsvConfig>) => void;
  setBasesXlsx: (patch: Partial<BasesXlsxConfig>) => void;

  // Setters de overrides por variable. Pasar `undefined` en un campo
  // elimina ese override (vuelve a la inferencia). Pasar ambos en
  // undefined elimina el override completo de la variable.
  setBasesOverride: (name: string, patch: Partial<BasesOverride>) => void;
  clearBasesOverride: (name: string) => void;
  clearAllBasesOverrides: () => void;

  // Setters específicos de cruces_vars (schema v2: [{name, excluidas}]).
  addCruceVar: (name: string) => void;
  removeCruceVar: (name: string) => void;
  setCruceVarExcluidas: (name: string, excluidas: string[]) => void;

  // Setters de dimensiones. Granularidad media: la UI emite patches por
  // sub-grupo (listas_objetivo, subindices, indices, semaforo, …). Cambios
  // estructurales (añadir/quitar bloque) se hacen reescribiendo el array
  // completo desde el componente, igual que Cruces hace con cruces_vars.
  setDimensiones: (patch: Partial<DimensionesConfig>) => void;
  setDimensionesSubindices: (subindices: BloqueConfig[]) => void;
  setDimensionesIndices: (indices: IndiceConfig[]) => void;
  setDimensionesSemaforo: (patch: Partial<DimensionesSemaforo>) => void;
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

  setVariablesExcluidas: (variables_excluidas) =>
    set((s) => dirty({ config: { ...s.config, variables_excluidas } })),

  toggleVariableExcluida: (name) =>
    set((s) => {
      const list = s.config.variables_excluidas;
      const next = list.includes(name) ? list.filter((x) => x !== name) : [...list, name];
      return dirty({ config: { ...s.config, variables_excluidas: next } });
    }),

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

  setBasesSav: (patch) =>
    set((s) =>
      dirty({
        config: {
          ...s.config,
          bases: { ...s.config.bases, sav: { ...s.config.bases.sav, ...patch } },
        },
      }),
    ),

  setBasesCsv: (patch) =>
    set((s) =>
      dirty({
        config: {
          ...s.config,
          bases: { ...s.config.bases, csv: { ...s.config.bases.csv, ...patch } },
        },
      }),
    ),

  setBasesXlsx: (patch) =>
    set((s) =>
      dirty({
        config: {
          ...s.config,
          bases: { ...s.config.bases, xlsx: { ...s.config.bases.xlsx, ...patch } },
        },
      }),
    ),

  setBasesOverride: (name, patch) =>
    set((s) => {
      const current = s.config.bases.overrides[name] ?? {};
      const merged: BasesOverride = { ...current, ...patch };
      // Si tras el merge no queda ninguna key, eliminar el override.
      const isEmpty = merged.measure === undefined && merged.format_spss === undefined;
      const overrides = { ...s.config.bases.overrides };
      if (isEmpty) delete overrides[name];
      else overrides[name] = merged;
      return dirty({
        config: { ...s.config, bases: { ...s.config.bases, overrides } },
      });
    }),

  clearBasesOverride: (name) =>
    set((s) => {
      const overrides = { ...s.config.bases.overrides };
      delete overrides[name];
      return dirty({
        config: { ...s.config, bases: { ...s.config.bases, overrides } },
      });
    }),

  clearAllBasesOverrides: () =>
    set((s) =>
      dirty({
        config: { ...s.config, bases: { ...s.config.bases, overrides: {} } },
      }),
    ),

  addCruceVar: (name) =>
    set((s) => {
      const clean = name.trim();
      if (!clean) return s;
      if (s.config.cruces.cruces_vars.some((cv) => cv.name === clean)) return s;
      return dirty({
        config: {
          ...s.config,
          cruces: { ...s.config.cruces, cruces_vars: [...s.config.cruces.cruces_vars, { name: clean }] },
        },
      });
    }),

  removeCruceVar: (name) =>
    set((s) =>
      dirty({
        config: {
          ...s.config,
          cruces: { ...s.config.cruces, cruces_vars: s.config.cruces.cruces_vars.filter((cv) => cv.name !== name) },
        },
      }),
    ),

  setCruceVarExcluidas: (name, excluidas) =>
    set((s) =>
      dirty({
        config: {
          ...s.config,
          cruces: {
            ...s.config.cruces,
            cruces_vars: s.config.cruces.cruces_vars.map((cv) =>
              cv.name === name ? { ...cv, excluidas: excluidas.length > 0 ? excluidas : undefined } : cv,
            ),
          },
        },
      }),
    ),

  setDimensiones: (patch) =>
    set((s) =>
      dirty({ config: { ...s.config, dimensiones: { ...s.config.dimensiones, ...patch } } }),
    ),

  setDimensionesSubindices: (subindices) =>
    set((s) =>
      dirty({ config: { ...s.config, dimensiones: { ...s.config.dimensiones, subindices } } }),
    ),

  setDimensionesIndices: (indices) =>
    set((s) =>
      dirty({ config: { ...s.config, dimensiones: { ...s.config.dimensiones, indices } } }),
    ),

  setDimensionesSemaforo: (patch) =>
    set((s) =>
      dirty({
        config: {
          ...s.config,
          dimensiones: {
            ...s.config.dimensiones,
            semaforo: { ...s.config.dimensiones.semaforo, ...patch },
          },
        },
      }),
    ),
}));

// ----- Migración schema v2 cruces_vars --------------------------------------
// Convierte legacy `cruces_vars: string[]` a `CruceVarConfig[]`. Se aplica
// al hidratar la config del backend para no romper JSONs exportados antes
// del rediseño.
export function normalizeCrucesVars(raw: unknown): CruceVarConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (typeof x === "string") return { name: x };
      if (x && typeof x === "object" && "name" in x && typeof (x as { name: unknown }).name === "string") {
        const o = x as { name: string; excluidas?: unknown };
        const excl = Array.isArray(o.excluidas)
          ? o.excluidas.map(String).filter((s) => s.length > 0)
          : undefined;
        return { name: o.name, excluidas: excl };
      }
      return null;
    })
    .filter((x): x is CruceVarConfig => !!x && !!x.name);
}
