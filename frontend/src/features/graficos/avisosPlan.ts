// Avisos del plan al abrirlo (la población antigua que el backend migró): el GET de la config los trae UNA sola vez,
// lo haga quien lo haga (el calentamiento de arranque, la hidratación, un reintento). Este store es su único destino y
// los guarda por sesión hasta que el usuario los vea: en Láminas, en el canal de Avisos (contador de la barra y panel);
// en el Editor anterior, con un toast que no se cierra solo.

import { create } from "zustand";
import { getSession } from "../../api/core";
import { fijarSumideroAvisosConfig } from "../../api/graficosAvisosConfig";
import { toast } from "../../components/toasterStore";

type AvisosPlanStore = {
  porSesion: Record<string, string[]>;
  recibir: (sid: string | null, avisos: readonly string[]) => string[];
};

export const useAvisosPlan = create<AvisosPlanStore>((set, get) => ({
  porSesion: {},
  /** Agrega sin repetir; devuelve sólo los nuevos. */
  recibir: (sid, avisos) => {
    const clave = sid ?? "";
    const previos = get().porSesion[clave] ?? [];
    const nuevos = avisos.filter((a) => !previos.includes(a));
    if (nuevos.length) set((s) => ({ porSesion: { ...s.porSesion, [clave]: [...previos, ...nuevos] } }));
    return nuevos;
  },
}));

/** Los avisos del plan de la sesión actual. */
export function useAvisosPlanSesion(): string[] {
  const porSesion = useAvisosPlan((s) => s.porSesion);
  return porSesion[getSession() ?? ""] ?? VACIO;
}
const VACIO: string[] = [];

export function anunciarAvisosPlan(nuevos: readonly string[]): void {
  if (!nuevos.length) return;
  toast.aviso(nuevos.length === 1 ? "El plan de gráficos cambió al abrirlo" : `El plan de gráficos cambió al abrirlo (${nuevos.length} avisos)`, {
    detalle: `${nuevos[0]}${nuevos.length > 1 ? " …" : ""} Detalle en Láminas › Avisos.`,
    duracion: 0,
  });
}

fijarSumideroAvisosConfig((sid, avisos) => anunciarAvisosPlan(useAvisosPlan.getState().recibir(sid, avisos)));
