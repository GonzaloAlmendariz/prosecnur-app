import { create } from "zustand";
import type {
  CalcMuestraEstudio,
  CalcMuestraComponente,
  CalcMuestraModoTrabajo,
  CalcMuestraMacroFamilia,
  CalcMuestraWorkspace,
} from "../../../api/client";
import { DEFAULT_CALC_MUESTRA_ESTUDIO } from "../../../api/client";

type State = {
  estudio: CalcMuestraEstudio;
  componenteActivoId: string | null;
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
  setTitulo: (titulo: string) => void;
  setModoTrabajo: (modo: CalcMuestraModoTrabajo) => void;
  setMacroFamilia: (f: CalcMuestraMacroFamilia) => void;
  setModoSensible: (v: boolean) => void;
  setContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  setComponentes: (comps: CalcMuestraComponente[]) => void;
  upsertComponente: (comp: CalcMuestraComponente) => void;
  removerComponente: (id: string) => void;
  setComponenteActivo: (id: string | null) => void;
  setCalculando: (v: boolean) => void;
  setReporteMeta: (m: { disponible: boolean; jobId?: string | null }) => void;
  reset: () => void;
  markClean: () => void;
};

const initial: State = {
  estudio: DEFAULT_CALC_MUESTRA_ESTUDIO,
  componenteActivoId: null,
  hydrated: false,
  dirty: false,
  calculando: false,
  reporteDisponible: false,
  reporteJobId: null,
};

export const useCalcMuestraStore = create<State & Actions>((set, get) => ({
  ...initial,
  hydrate: (estudio) =>
    set(() => ({
      estudio,
      componenteActivoId: estudio.componentes[0]?.id ?? null,
      hydrated: true,
      dirty: false,
    })),
  replaceEstudio: (estudio) =>
    set(() => ({
      estudio,
      componenteActivoId: estudio.componentes[0]?.id ?? null,
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
  setTitulo: (titulo) =>
    set((s) => ({ estudio: { ...s.estudio, titulo }, dirty: true })),
  setModoTrabajo: (modo_trabajo) =>
    set((s) => ({ estudio: { ...s.estudio, modo_trabajo }, dirty: true })),
  setMacroFamilia: (macro_familia) =>
    set((s) => ({ estudio: { ...s.estudio, macro_familia }, dirty: true })),
  setModoSensible: (modo_sensible) =>
    set((s) => ({ estudio: { ...s.estudio, modo_sensible }, dirty: true })),
  setContexto: (campo, valor) =>
    set((s) => ({
      estudio: { ...s.estudio, contexto: { ...s.estudio.contexto, [campo]: valor } },
      dirty: true,
    })),
  setComponentes: (componentes) =>
    set((s) => ({
      estudio: { ...s.estudio, componentes },
      componenteActivoId:
        componentes.find((c) => c.id === s.componenteActivoId)?.id ?? componentes[0]?.id ?? null,
      dirty: true,
    })),
  upsertComponente: (comp) =>
    set((s) => {
      const idx = s.estudio.componentes.findIndex((c) => c.id === comp.id);
      const componentes =
        idx >= 0
          ? s.estudio.componentes.map((c) => (c.id === comp.id ? comp : c))
          : [...s.estudio.componentes, comp];
      return {
        estudio: { ...s.estudio, componentes },
        componenteActivoId: comp.id,
        dirty: true,
      };
    }),
  removerComponente: (id) =>
    set((s) => {
      const componentes = s.estudio.componentes.filter((c) => c.id !== id);
      return {
        estudio: { ...s.estudio, componentes },
        componenteActivoId:
          s.componenteActivoId === id ? componentes[0]?.id ?? null : s.componenteActivoId,
        dirty: true,
      };
    }),
  setComponenteActivo: (id) => set(() => ({ componenteActivoId: id })),
  setCalculando: (calculando) => set(() => ({ calculando })),
  setReporteMeta: ({ disponible, jobId }) =>
    set(() => ({
      reporteDisponible: disponible,
      reporteJobId: jobId ?? null,
    })),
  reset: () => set(() => ({ ...initial })),
  markClean: () => set(() => ({ dirty: false })),
}));

export function componenteActivo(): CalcMuestraComponente | null {
  const { estudio, componenteActivoId } = useCalcMuestraStore.getState();
  if (!componenteActivoId) return null;
  return estudio.componentes.find((c) => c.id === componenteActivoId) ?? null;
}
