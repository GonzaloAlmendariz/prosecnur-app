import { create } from "zustand";
import type {
  CalcMuestraEstudio,
  CalcMuestraComponente,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceMotorRecorrido,
} from "../../../api/client";
import { DEFAULT_CALC_MUESTRA_ESTUDIO } from "../../../api/client";
import { EMPTY_WORKSPACE } from "../workspaceDefaults";

type State = {
  estudio: CalcMuestraEstudio;
  hydrated: boolean;
  dirty: boolean;
  calculando: boolean;
  reporteDisponible: boolean;
  reporteJobId: string | null;
};

type Actions = {
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

const initial: State = {
  estudio: DEFAULT_CALC_MUESTRA_ESTUDIO,
  hydrated: false,
  dirty: false,
  calculando: false,
  reporteDisponible: false,
  reporteJobId: null,
};

export const useCalcMuestraStore = create<State & Actions>((set) => ({
  ...initial,
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
