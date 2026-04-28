import { create } from "zustand";
import {
  BloqueConfig,
  DimensionesConfig,
  IndiceConfig,
  SubcriterioConfig,
} from "../store";

// Store local del wizard de Dimensiones. Vive aparte del store global
// de Analítica (`useAnaliticaStore`) por dos razones:
//
// 1) El wizard tiene estado de UI puro (paso actual, transición en curso,
//    flags de "acabo de mover esta variable" para animar badge-fresh) que
//    no debe persistirse al backend.
// 2) El "draft" del wizard es editable libremente sin disparar autosave
//    cada keystroke. Solo al pulsar "Generar" en step 5 promovemos el
//    draft al store de Analítica (que entonces sí autosaves al backend).

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export type FreshHighlight = {
  // Marca temporal de "esto se acaba de añadir/mover" para animar
  // `pulso-badge-fresh` o `pulso-card-glow` por unos ms en el componente.
  // Key = identificador (var name, bloque name, etc.). Valor = timestamp.
  [key: string]: number;
};

type WizardStore = {
  step: WizardStep;
  draft: DimensionesConfig;
  // Highlights transitorios para feedback visual.
  freshVars: FreshHighlight;
  freshBloques: FreshHighlight;
  // Bandera: el draft proviene de "Confirmar JSON" y arranca con vars
  // pre-validadas (algunas posiblemente inválidas). El wizard muestra
  // chips ⚠ en los faltantes.
  varsFaltantesJson: string[];

  // Navigation
  goTo: (s: WizardStep) => void;
  next: () => void;
  back: () => void;

  // Draft mutations — cada una marca highlights y NO persiste al backend
  // hasta que el usuario confirma en step 5.
  setDraft: (d: DimensionesConfig) => void;
  setListasObjetivo: (v: string[]) => void;
  setBloques: (b: BloqueConfig[]) => void;
  asignarVarABloque: (variable: string, bloqueNombre: string) => void;
  desasignarVar: (variable: string) => void;
  setIndices: (i: IndiceConfig[]) => void;

  // Recodificación per-lista (Step 2 expandible). Esto controla la
  // dirección 0→100 y los códigos especiales por lista.
  setOrdenLista: (lista: string, orden: string[]) => void;
  setCodigosNoAplica: (lista: string, codes: string[]) => void;
  setCodigosMissingGlobal: (codes: string[]) => void;

  // Subcriterios promediados — el usuario combina 2+ preguntas en un
  // indicador derivado (ej. p17 + p17.1 → "Diligencia"). El sistema crea
  // una columna r100_<nombre> al construir, promediando sus fuentes.
  // El nombre se persiste con prefijo (ej. "r100_p17_prom"); etiqueta es
  // el label humano ("Diligencia").
  agregarSubcriterio: (nombre: string, etiqueta: string, fuente: string[]) => void;
  actualizarSubcriterio: (nombreOriginal: string, patch: Partial<SubcriterioConfig>) => void;
  eliminarSubcriterio: (nombre: string) => void;

  // Etiqueta humana corta para una variable individual (ej. p12 →
  // "Respeto y amabilidad"). Se persiste en `labels_indicadores`. Si
  // `label` viene vacío, se elimina la entrada (vuelve al label largo
  // del instrumento).
  setLabelIndicador: (varName: string, label: string) => void;

  // Cuando un JSON importado tiene vars faltantes, las exponemos para
  // que step 3 las marque visualmente.
  setVarsFaltantesJson: (vars: string[]) => void;

  reset: () => void;
};

const EMPTY_DRAFT: DimensionesConfig = {
  listas_objetivo: [],
  excluir_vars: ["consent"],
  orden_por_lista: {},
  codigos_missing: ["75", "88", "90"],
  codigos_no_aplica: {},
  prefijo: "r100_",
  subcriterios: [],
  subindices: [],
  indices: [],
  semaforo: {
    cortes: [70, 80],
    colores: { rojo: "#E57E75", ambar: "#F4CA6A", verde: "#9DBB6D" },
  },
  radar: { paleta: "okabe_ito", min_ejes: 3 },
  labels_indices: {},
  labels_subindices: {},
  labels_indicadores: {},
};

export const useDimensionesWizardStore = create<WizardStore>((set) => ({
  step: 1,
  draft: EMPTY_DRAFT,
  freshVars: {},
  freshBloques: {},
  varsFaltantesJson: [],

  goTo: (s) => set({ step: s }),
  next: () =>
    set((st) => ({ step: Math.min(5, st.step + 1) as WizardStep })),
  back: () =>
    set((st) => ({ step: Math.max(1, st.step - 1) as WizardStep })),

  setDraft: (d) => set({ draft: d }),
  setListasObjetivo: (v) =>
    set((st) => ({ draft: { ...st.draft, listas_objetivo: v } })),
  setBloques: (b) =>
    set((st) => {
      const fresh: FreshHighlight = {};
      const now = Date.now();
      b.forEach((bb) => {
        if (!st.draft.subindices.find((x) => x.nombre === bb.nombre)) {
          fresh[bb.nombre] = now;
        }
      });
      return {
        draft: { ...st.draft, subindices: b },
        freshBloques: { ...st.freshBloques, ...fresh },
      };
    }),
  asignarVarABloque: (variable, bloqueNombre) =>
    set((st) => {
      // Quita la variable de cualquier bloque previo (una variable solo
      // puede estar en un bloque a la vez) y la pone en `bloqueNombre`.
      const bloques = st.draft.subindices.map((b) => {
        const filtered = b.vars.filter((v) => v !== variable);
        if (b.nombre === bloqueNombre) {
          if (!filtered.includes(variable)) filtered.push(variable);
        }
        return { ...b, vars: filtered };
      });
      return {
        draft: { ...st.draft, subindices: bloques },
        freshVars: { ...st.freshVars, [variable]: Date.now() },
      };
    }),
  desasignarVar: (variable) =>
    set((st) => ({
      draft: {
        ...st.draft,
        subindices: st.draft.subindices.map((b) => ({
          ...b,
          vars: b.vars.filter((v) => v !== variable),
        })),
      },
    })),
  setIndices: (i) =>
    set((st) => ({ draft: { ...st.draft, indices: i } })),

  setOrdenLista: (lista, orden) =>
    set((st) => ({
      draft: {
        ...st.draft,
        orden_por_lista: { ...st.draft.orden_por_lista, [lista]: orden },
      },
    })),
  setCodigosNoAplica: (lista, codes) =>
    set((st) => {
      const next = { ...st.draft.codigos_no_aplica };
      if (codes.length === 0) delete next[lista];
      else next[lista] = codes;
      return { draft: { ...st.draft, codigos_no_aplica: next } };
    }),
  setCodigosMissingGlobal: (codes) =>
    set((st) => ({ draft: { ...st.draft, codigos_missing: codes } })),

  agregarSubcriterio: (nombre, etiqueta, fuente) =>
    set((st) => {
      // Persistimos con prefijo para que viaje listo al backend, pero el
      // usuario solo ve el nombre crudo en la UI.
      const prefijo = st.draft.prefijo || "r100_";
      const nombrePref = nombre.startsWith(prefijo) ? nombre : `${prefijo}${nombre}`;
      const fuentePref = fuente.map((f) =>
        f.startsWith(prefijo) ? f : `${prefijo}${f}`,
      );
      // Si ya existe un subcriterio con ese nombre, lo reemplazamos.
      const filtered = st.draft.subcriterios.filter((s) => s.nombre !== nombrePref);
      return {
        draft: {
          ...st.draft,
          subcriterios: [
            ...filtered,
            { nombre: nombrePref, etiqueta, fuente: fuentePref },
          ],
        },
      };
    }),
  actualizarSubcriterio: (nombreOriginal, patch) =>
    set((st) => {
      const prefijo = st.draft.prefijo || "r100_";
      return {
        draft: {
          ...st.draft,
          subcriterios: st.draft.subcriterios.map((s) => {
            if (s.nombre !== nombreOriginal) return s;
            const next: SubcriterioConfig = { ...s, ...patch };
            // Re-prefijar nombre y fuentes si el patch los cambió.
            if (patch.nombre && !patch.nombre.startsWith(prefijo)) {
              next.nombre = `${prefijo}${patch.nombre}`;
            }
            if (patch.fuente) {
              next.fuente = patch.fuente.map((f) =>
                f.startsWith(prefijo) ? f : `${prefijo}${f}`,
              );
            }
            return next;
          }),
        },
      };
    }),
  eliminarSubcriterio: (nombre) =>
    set((st) => ({
      draft: {
        ...st.draft,
        subcriterios: st.draft.subcriterios.filter((s) => s.nombre !== nombre),
        // Si el subcriterio estaba asignado a algún bloque, lo quitamos
        // también para no dejar referencia colgante.
        subindices: st.draft.subindices.map((b) => ({
          ...b,
          vars: b.vars.filter((v) => v !== nombre),
        })),
      },
    })),

  setLabelIndicador: (varName, label) =>
    set((st) => {
      const next = { ...st.draft.labels_indicadores };
      const prefijo = st.draft.prefijo || "r100_";
      const conPrefijo = varName.startsWith(prefijo) ? varName : `${prefijo}${varName}`;
      const sinPrefijo = varName.replace(new RegExp(`^${prefijo}`), "");
      // Limpiamos las dos variantes para evitar duplicados al renombrar.
      delete next[conPrefijo];
      delete next[sinPrefijo];
      const limpio = label.trim();
      if (limpio) {
        // Persistimos con prefijo porque el backend aplica los labels
        // sobre las columnas r100_*/idx_*/sub_* tras el build.
        next[conPrefijo] = limpio;
      }
      return { draft: { ...st.draft, labels_indicadores: next } };
    }),

  setVarsFaltantesJson: (vars) => set({ varsFaltantesJson: vars }),

  reset: () =>
    set({
      step: 1,
      draft: EMPTY_DRAFT,
      freshVars: {},
      freshBloques: {},
      varsFaltantesJson: [],
    }),
}));

// El software es neutral por diseño: NO incluye plantillas hardcoded de
// estudios específicos. Las recetas concretas (GIZ, otros) viven como
// archivos JSON externos que el analista importa via Step 1 →
// "Importar receta y confirmar". Si en el futuro queremos una galería
// de plantillas pre-armadas, vivirán en backend (`/api/analitica/
// dimensiones/plantillas`) o en una carpeta del proyecto, pero nunca
// hardcoded en el código del frontend.
