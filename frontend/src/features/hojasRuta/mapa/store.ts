import { create } from "zustand";
import type { HojasRutaAgeRange } from "../../../api/hojasRuta";

/**
 * Estado efímero de la página del lienzo (ADR 0114): lo que el usuario va
 * eligiendo y no se guarda hasta confirmar. Lo duro (territorios confirmados,
 * salidas del motor) vive en el backend.
 */
type EstadoLienzo = {
  /** Distritos en borrador; `null` = igual a los confirmados (no hay cambios). */
  borrador: string[] | null;
  busquedaDistrito: string;
  soloElegidos: boolean;
  distritoBajoCursor: string | null;
  /** Rangos de edad en edición; `null` = los de la configuración. */
  rangosBorrador: HojasRutaAgeRange[] | null;
  setRangosBorrador: (next: HojasRutaAgeRange[] | null) => void;
  setBorrador: (next: string[] | null) => void;
  setBusquedaDistrito: (texto: string) => void;
  setSoloElegidos: (valor: boolean) => void;
  setDistritoBajoCursor: (ubigeo: string | null) => void;
  reiniciar: () => void;
};

const INICIAL = { borrador: null, busquedaDistrito: "", soloElegidos: false, distritoBajoCursor: null, rangosBorrador: null };

export const useLienzoHojasRuta = create<EstadoLienzo>((set) => ({
  ...INICIAL,
  setBorrador: (borrador) => set({ borrador }),
  setRangosBorrador: (rangosBorrador) => set({ rangosBorrador }),
  setBusquedaDistrito: (busquedaDistrito) => set({ busquedaDistrito }),
  setSoloElegidos: (soloElegidos) => set({ soloElegidos }),
  setDistritoBajoCursor: (distritoBajoCursor) => set((s) => (s.distritoBajoCursor === distritoBajoCursor ? s : { distritoBajoCursor })),
  reiniciar: () => set(INICIAL),
}));
