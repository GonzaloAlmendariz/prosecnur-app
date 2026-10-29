import { create } from "zustand";
import type { HojasRutaAgeRange } from "../../../api/hojasRuta";
import type { BorradorSorteo } from "./manzanas/sorteo";
import type { BorradorMuestra } from "./muestra/desdeConfig";

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
  /** Parche sobre la configuración de Muestra; `null` = sin cambios. */
  muestraBorrador: BorradorMuestra | null;
  setMuestraBorrador: (next: BorradorMuestra | null) => void;
  /** Parámetros del sorteo en edición; `null` = los guardados. */
  sorteoBorrador: BorradorSorteo | null;
  setSorteoBorrador: (next: BorradorSorteo | null) => void;
  /** Vértices (en el mundo del lienzo) del área que se está dibujando; `null` = no se dibuja. */
  dibujoArea: [number, number][] | null;
  setDibujoArea: (v: [number, number][] | null) => void;
  soloPorRevisar: boolean;
  setSoloPorRevisar: (v: boolean) => void;
  busquedaUmp: string;
  setBusquedaUmp: (texto: string) => void;
  setBorrador: (next: string[] | null) => void;
  setBusquedaDistrito: (texto: string) => void;
  setSoloElegidos: (valor: boolean) => void;
  setDistritoBajoCursor: (ubigeo: string | null) => void;
  reiniciar: () => void;
};

const INICIAL = { borrador: null, busquedaDistrito: "", soloElegidos: false, distritoBajoCursor: null, rangosBorrador: null, muestraBorrador: null, sorteoBorrador: null, dibujoArea: null, soloPorRevisar: false, busquedaUmp: "" };

export const useLienzoHojasRuta = create<EstadoLienzo>((set) => ({
  ...INICIAL,
  setBorrador: (borrador) => set({ borrador }),
  setRangosBorrador: (rangosBorrador) => set({ rangosBorrador }),
  setMuestraBorrador: (muestraBorrador) => set({ muestraBorrador }),
  setSorteoBorrador: (sorteoBorrador) => set({ sorteoBorrador }),
  setDibujoArea: (dibujoArea) => set({ dibujoArea }),
  setSoloPorRevisar: (soloPorRevisar) => set({ soloPorRevisar }),
  setBusquedaUmp: (busquedaUmp) => set({ busquedaUmp }),
  setBusquedaDistrito: (busquedaDistrito) => set({ busquedaDistrito }),
  setSoloElegidos: (soloElegidos) => set({ soloElegidos }),
  setDistritoBajoCursor: (distritoBajoCursor) => set((s) => (s.distritoBajoCursor === distritoBajoCursor ? s : { distritoBajoCursor })),
  reiniciar: () => set(INICIAL),
}));
