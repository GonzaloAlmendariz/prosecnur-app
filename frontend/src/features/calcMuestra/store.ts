import { create } from "zustand";
import type {
  CalcMuestraEstudio,
  CalcMuestraComponente,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceMotorRecorrido,
} from "../../api/client";
import { DEFAULT_CALC_MUESTRA_ESTUDIO } from "../../api/client";
import { EMPTY_WORKSPACE } from "./workspaceDefaults";
import {
  decisionesPorDefecto,
  perfilPorId,
  PLANTILLA_UNIVERSIDAD,
  type BaseCursosHorario,
  type DecisionesRecorrido,
  type FacultadDatos,
  type ParametrosMuestra,
  type PerfilInstitucional,
  type ResumenEstAula,
} from "./dominio";

// =============================================================================
// Store de Cálculo de muestra — hogar canónico único del feature
// =============================================================================
// Antes vivían dos stores en carpetas distintas (`store/calcMuestraStore.ts`
// y `motor/store.ts`), lo que generaba ambigüedad de hogar. Este archivo los
// consolida siguiendo el patrón de `validacion/store.ts`:
//
// 1. `useCalcMuestraStore` — espejo local del ESTADO DURO del estudio, que
//    vive en el backend (`calc_muestra_estudio` de la sesión). Hidrata al
//    montar, marca `dirty` con cada cambio y el autosave debounced
//    (`useCalcMuestraAutosave`) lo persiste. Cambiar de proyecto pasa por
//    `hydrate()` (pulso:session-changed), que deja `dirty` en false.
//
// 2. `useMotorStore` — estado UI del motor muestral (perfil editable,
//    decisiones de cálculo, fuente de datos). Es efímero por diseño: se
//    serializa hacia `workspace.motor_recorrido` del estudio mediante
//    `useMotorPersistencia`, que SUSCRIBE a este store y sincroniza hacia
//    `useCalcMuestraStore`. Por esa suscripción cruzada los dos hooks se
//    mantienen como `create()` separados: fusionarlos en un solo store haría
//    que la sincronización motor→estudio se re-dispare a sí misma.

// ----- Estado duro del estudio (espejo del backend) --------------------------

type EstudioState = {
  estudio: CalcMuestraEstudio;
  hydrated: boolean;
  dirty: boolean;
  calculando: boolean;
  reporteDisponible: boolean;
  reporteJobId: string | null;
};

type EstudioActions = {
  hydrate: (estudio: CalcMuestraEstudio) => void;
  replaceEstudio: (estudio: CalcMuestraEstudio) => void;
  patchEstudio: (patch: Partial<CalcMuestraEstudio>) => void;
  setWorkspace: (workspace: CalcMuestraWorkspace | null) => void;
  /** Patchea SOLO motor_recorrido preservando el resto del workspace. */
  setWorkspaceMotorRecorrido: (mr: CalcMuestraWorkspaceMotorRecorrido) => void;
  setTitulo: (titulo: string) => void;
  setContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  setComponentes: (comps: CalcMuestraComponente[]) => void;
  setCalculando: (v: boolean) => void;
  setReporteMeta: (m: { disponible: boolean; jobId?: string | null }) => void;
  markClean: () => void;
};

const initialEstudio: EstudioState = {
  estudio: DEFAULT_CALC_MUESTRA_ESTUDIO,
  hydrated: false,
  dirty: false,
  calculando: false,
  reporteDisponible: false,
  reporteJobId: null,
};

export const useCalcMuestraStore = create<EstudioState & EstudioActions>((set) => ({
  ...initialEstudio,
  hydrate: (estudio) =>
    set(() => ({
      estudio,
      hydrated: true,
      dirty: false,
    })),
  replaceEstudio: (estudio) =>
    set(() => ({
      estudio,
      dirty: true,
    })),
  patchEstudio: (patch) =>
    set((s) => ({
      estudio: { ...s.estudio, ...patch },
      dirty: true,
    })),
  setWorkspace: (workspace) =>
    set((s) => ({
      estudio: { ...s.estudio, workspace },
      dirty: true,
    })),
  setWorkspaceMotorRecorrido: (mr) =>
    set((s) => ({
      estudio: {
        ...s.estudio,
        workspace: { ...(s.estudio.workspace ?? EMPTY_WORKSPACE), motor_recorrido: mr },
      },
      dirty: true,
    })),
  setTitulo: (titulo) =>
    set((s) => ({ estudio: { ...s.estudio, titulo }, dirty: true })),
  setContexto: (campo, valor) =>
    set((s) => ({
      estudio: { ...s.estudio, contexto: { ...s.estudio.contexto, [campo]: valor } },
      dirty: true,
    })),
  setComponentes: (componentes) =>
    set((s) => ({
      estudio: { ...s.estudio, componentes },
      dirty: true,
    })),
  setCalculando: (calculando) => set(() => ({ calculando })),
  setReporteMeta: ({ disponible, jobId }) =>
    set(() => ({
      reporteDisponible: disponible,
      reporteJobId: jobId ?? null,
    })),
  markClean: () => set(() => ({ dirty: false })),
}));

// ----- Estado UI del motor muestral (efímero, serializado al workspace) -----

export type FuenteDatos = "proyecto" | "manual";

function clonarPerfil(perfil: PerfilInstitucional): PerfilInstitucional {
  return structuredClone(perfil);
}

type MotorState = {
  /** Preferencia de fuente; si el proyecto no tiene datos, cae a manual. */
  fuente: FuenteDatos;
  /** Perfil editable (configuración + datos manuales). */
  perfil: PerfilInstitucional;
  decisiones: DecisionesRecorrido;
  /** true si el usuario movió parámetros/decisiones respecto del canon. */
  tocado: boolean;
  setFuente: (fuente: FuenteDatos) => void;
  /**
   * Reemplaza el estado con un snapshot persistido (workspace del estudio),
   * sin efectos secundarios: set directo, ya normalizado por `persistencia.ts`.
   */
  hidratar: (payload: {
    fuente: FuenteDatos;
    perfil: PerfilInstitucional;
    decisiones: DecisionesRecorrido;
    tocado: boolean;
  }) => void;
  /** Carga una plantilla o el ejemplo (resetea decisiones al canon del perfil). */
  cargarPerfil: (id: string) => void;
  setInstitucion: (patch: Partial<Pick<PerfilInstitucional, "nombre" | "etiquetaUnidad" | "etapa" | "anio">>) => void;
  setModeloBases: (bases: 1 | 2) => void;
  upsertUnidad: (unidad: FacultadDatos) => void;
  eliminarUnidad: (id: string) => void;
  setParametro: (patch: Partial<ParametrosMuestra>) => void;
  toggleOpcional: (id: string) => void;
  setBolsa: (extraPorFacultad: number) => void;
  setEscenario: (escenario: DecisionesRecorrido["escenario"]) => void;
  /** Cursos-horario extra (0/1/2) para una facultad (§5.3 · stepper por facultad). */
  setAulaExtraFacultad: (facultad: string, extra: number) => void;
  /** Base de cálculo de cursos-horario del marco (total vs elegible). */
  setCursosHorarioBase: (base: BaseCursosHorario) => void;
  /**
   * Método GLOBAL de resumen de estudiantes-por-aula (el divisor del cálculo de
   * aulas). Vive en el perfil porque el motor (escenario1) lo lee de ahí; una
   * sola elección gobierna todas las facultades. Invalida el plan confirmado:
   * cambiar el divisor cambia los CH necesarios.
   */
  setResumenEstAula: (resumen: ResumenEstAula) => void;
  /** Confirma (o revoca) el plan definitivo de cursos-horario por facultad. */
  confirmarCursosHorario: (final: Record<string, number> | null) => void;
  resetCanon: () => void;
  /**
   * Vuelve el motor al estado de fábrica (plantilla + decisiones canon, sin
   * tocar). Lo usa la persistencia al hidratar un estudio SIN motor_recorrido
   * después de otro estudio (F3): el store es global y sin este reset la
   * primera interacción arrastraría el perfil del proyecto anterior.
   */
  resetInicial: () => void;
};

export const useMotorStore = create<MotorState>((set) => ({
  fuente: "proyecto",
  perfil: clonarPerfil(PLANTILLA_UNIVERSIDAD),
  decisiones: decisionesPorDefecto(PLANTILLA_UNIVERSIDAD),
  tocado: false,
  setFuente: (fuente) => set({ fuente }),
  hidratar: ({ fuente, perfil, decisiones, tocado }) =>
    set({ fuente, perfil, decisiones, tocado }),
  cargarPerfil: (id) =>
    set(() => {
      const perfil = clonarPerfil(perfilPorId(id) ?? PLANTILLA_UNIVERSIDAD);
      return { perfil, decisiones: decisionesPorDefecto(perfil), tocado: false, fuente: "manual" as const };
    }),
  setInstitucion: (patch) =>
    set((state) => ({ perfil: { ...state.perfil, ...patch } })),
  setModeloBases: (bases) =>
    set((state) => ({
      perfil: {
        ...state.perfil,
        modeloDatos: {
          ...state.perfil.modeloDatos,
          bases,
          llaveCruce: bases === 2 ? state.perfil.modeloDatos.llaveCruce ?? "curso-horario" : null,
        },
      },
    })),
  upsertUnidad: (unidad) =>
    set((state) => {
      const existe = state.perfil.facultades.some((f) => f.id === unidad.id);
      const facultades = existe
        ? state.perfil.facultades.map((f) => (f.id === unidad.id ? { ...f, ...unidad } : f))
        : [...state.perfil.facultades, unidad];
      // Editar los datos rompe la pureza del ejemplo: pasa a ser perfil propio.
      return { perfil: { ...state.perfil, facultades, esEjemplo: false } };
    }),
  eliminarUnidad: (id) =>
    set((state) => ({
      perfil: {
        ...state.perfil,
        facultades: state.perfil.facultades.filter((f) => f.id !== id),
        esEjemplo: false,
      },
    })),
  setParametro: (patch) =>
    set((state) => ({
      tocado: true,
      decisiones: { ...state.decisiones, parametros: { ...state.decisiones.parametros, ...patch } },
    })),
  toggleOpcional: (id) =>
    set((state) => {
      const activos = state.decisiones.opcionalesActivos.includes(id)
        ? state.decisiones.opcionalesActivos.filter((x) => x !== id)
        : [...state.decisiones.opcionalesActivos, id];
      return { tocado: true, decisiones: { ...state.decisiones, opcionalesActivos: activos } };
    }),
  setBolsa: (extraPorFacultad) =>
    set((state) => ({
      tocado: true,
      decisiones: { ...state.decisiones, bolsaExtraPorFacultad: extraPorFacultad },
    })),
  setEscenario: (escenario) =>
    set((state) => ({ tocado: true, decisiones: { ...state.decisiones, escenario } })),
  setAulaExtraFacultad: (facultad, extra) =>
    set((state) => {
      const limpio = Math.max(0, Math.min(2, Math.round(extra)));
      const aulasExtraPorFacultad = { ...state.decisiones.aulasExtraPorFacultad, [facultad]: limpio };
      // Cambiar el agregado invalida el plan confirmado: hay que reconfirmar.
      return {
        tocado: true,
        decisiones: {
          ...state.decisiones,
          aulasExtraPorFacultad,
          cursosHorarioConfirmado: false,
        },
      };
    }),
  setCursosHorarioBase: (base) =>
    set((state) => ({
      tocado: true,
      decisiones: { ...state.decisiones, cursosHorarioBase: base, cursosHorarioConfirmado: false },
    })),
  setResumenEstAula: (resumen) =>
    set((state) => ({
      tocado: true,
      perfil: { ...state.perfil, resumenEstAula: resumen },
      decisiones: { ...state.decisiones, cursosHorarioConfirmado: false },
    })),
  confirmarCursosHorario: (final) =>
    set((state) => ({
      tocado: true,
      decisiones: {
        ...state.decisiones,
        cursosHorarioConfirmado: final != null,
        cursosHorarioFinal: final ?? state.decisiones.cursosHorarioFinal,
      },
    })),
  resetCanon: () =>
    set((state) => ({ decisiones: decisionesPorDefecto(state.perfil), tocado: false })),
  resetInicial: () =>
    set(() => ({
      fuente: "proyecto" as const,
      perfil: clonarPerfil(PLANTILLA_UNIVERSIDAD),
      decisiones: decisionesPorDefecto(PLANTILLA_UNIVERSIDAD),
      tocado: false,
    })),
}));
