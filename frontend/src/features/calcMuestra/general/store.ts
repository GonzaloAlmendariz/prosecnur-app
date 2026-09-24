import { create } from "zustand";

import { getSession } from "../../../api/core";
import {
  apiCalcMuestraGeneralCorrida,
  apiCalcMuestraGeneralResumen,
  type CalcMuestraGeneralCorrida,
  type CalcMuestraGeneralMarco,
} from "../../../api/calcMuestraGeneral";

/**
 * Espejo local del estado de Muestra general (ADR 0090): marcos declarados y
 * corridas por componente. El estado duro vive en la sesión del backend
 * (`calc_muestra_general`); aquí sólo se guarda lo último que se leyó, atado al
 * `sid` con el que se leyó para no pintar el marco de otro proyecto.
 */
type GeneralState = {
  sid: string | null;
  cargado: boolean;
  cargando: boolean;
  error: string | null;
  marcos: Record<string, CalcMuestraGeneralMarco>;
  corridas: Record<string, CalcMuestraGeneralCorrida>;
  /** Componentes cuyo listado completo ya se pidió (evita pedirlo en bucle). */
  listadosPedidos: Record<string, true>;
};

type GeneralActions = {
  /** Lee `/state` si no se leyó para la sesión vigente. */
  cargar: (opciones?: { forzar?: boolean }) => Promise<void>;
  /** Trae el listado de la corrida del componente si falta. */
  cargarListado: (componenteId: string) => Promise<void>;
  setMarco: (componenteId: string, marco: CalcMuestraGeneralMarco) => void;
  setCorrida: (componenteId: string, corrida: CalcMuestraGeneralCorrida) => void;
  reset: () => void;
};

const INICIAL: GeneralState = {
  sid: null,
  cargado: false,
  cargando: false,
  error: null,
  marcos: {},
  corridas: {},
  listadosPedidos: {},
};

export const useMuestraGeneralStore = create<GeneralState & GeneralActions>((set, get) => ({
  ...INICIAL,
  cargar: async (opciones) => {
    const sid = getSession();
    const s = get();
    if (s.cargando) return;
    if (s.cargado && s.sid === sid && !opciones?.forzar) return;
    set({ ...INICIAL, sid, cargando: true });
    try {
      const resumen = await apiCalcMuestraGeneralResumen();
      // Si la sesión cambió mientras viajaba la petición, no se pinta.
      if (getSession() !== sid) {
        set({ cargando: false });
        return;
      }
      set({ cargado: true, cargando: false, error: null, marcos: resumen.marcos, corridas: resumen.corridas });
    } catch (e) {
      set({ cargado: true, cargando: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
  cargarListado: async (componenteId) => {
    const s = get();
    const corrida = s.corridas[componenteId];
    if (!corrida || corrida.unidades !== null || s.listadosPedidos[componenteId]) return;
    set({ listadosPedidos: { ...s.listadosPedidos, [componenteId]: true } });
    const sid = s.sid;
    try {
      const completa = await apiCalcMuestraGeneralCorrida(componenteId);
      if (getSession() !== sid || !completa) return;
      // Sólo si sigue siendo la misma corrida: un sorteo nuevo no se pisa.
      if (get().corridas[componenteId]?.corrida.run_id !== completa.corrida.run_id) return;
      set((prev) => ({ corridas: { ...prev.corridas, [componenteId]: completa } }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },
  setMarco: (componenteId, marco) =>
    set((prev) => {
      // Redeclarar invalida la corrida anterior de ese componente (lo mismo
      // que hace el motor).
      const { [componenteId]: _descartada, ...corridas } = prev.corridas;
      return { marcos: { ...prev.marcos, [componenteId]: marco }, corridas };
    }),
  setCorrida: (componenteId, corrida) =>
    set((prev) => ({ corridas: { ...prev.corridas, [componenteId]: corrida } })),
  reset: () => set({ ...INICIAL }),
}));
