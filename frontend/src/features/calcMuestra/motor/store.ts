/**
 * Estado UI del motor muestral (efímero, patrón del feature store): fuente de
 * datos, perfil editable y decisiones de cálculo. El estado duro del estudio
 * sigue viviendo en el backend vía el store del módulo.
 */
import { create } from "zustand";
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
} from "../dominio";

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
}));
