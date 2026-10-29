import { create } from "zustand";
import type { HojasRutaAgeRange, HojasRutaAgeRangeMode, HojasRutaAgeRangeScope } from "../../../api/hojasRuta";
import type { BorradorSorteo } from "./manzanas/sorteo";
import type { BorradorMuestra } from "./muestra/desdeConfig";
import type { CapaLienzo } from "./lienzo/LienzoMapa";

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
  /** Modo de los rangos (manual o cortes) y su base, sin aplicar hasta calcular la matriz (B28). */
  cortesBorrador: { modo: HojasRutaAgeRangeMode; base: HojasRutaAgeRangeScope } | null;
  setCortesBorrador: (next: { modo: HojasRutaAgeRangeMode; base: HojasRutaAgeRangeScope } | null) => void;
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
  /** Territorio: zona de Lima que filtra la lista (no selecciona). */
  zonaFiltro: string | null;
  setZonaFiltro: (zona: string | null) => void;
  /** Territorio: distrito cuya ficha se ve en el inspector (clic en el mapa; no selecciona). */
  distritoEnfocado: string | null;
  setDistritoEnfocado: (ubigeo: string | null) => void;
  /** Capa de las manzanas en Territorio, Manzanas y Selección (brecha B7). */
  capaMapa: CapaLienzo;
  /** Cajón inferior de Población (brecha B17/B29): la matriz entera, fuera del inspector. */
  cajonPoblacion: "matriz" | "pct" | null;
  setCajonPoblacion: (v: "matriz" | "pct" | null) => void;
  /** Cajón inferior de Muestra (B17): las cuotas por distrito, rango y sexo. */
  cajonMuestra: boolean;
  setCajonMuestra: (v: boolean) => void;
  setCapaMapa: (capa: CapaLienzo) => void;
  busquedaUmp: string;
  setBusquedaUmp: (texto: string) => void;
  setBorrador: (next: string[] | null) => void;
  setBusquedaDistrito: (texto: string) => void;
  setSoloElegidos: (valor: boolean) => void;
  setDistritoBajoCursor: (ubigeo: string | null) => void;
  reiniciar: () => void;
};

const INICIAL = { borrador: null, busquedaDistrito: "", soloElegidos: false, distritoBajoCursor: null, rangosBorrador: null, muestraBorrador: null, sorteoBorrador: null, dibujoArea: null, soloPorRevisar: false, busquedaUmp: "", capaMapa: "manzanas" as CapaLienzo, zonaFiltro: null as string | null, distritoEnfocado: null as string | null, cajonPoblacion: null as "matriz" | "pct" | null, cajonMuestra: false, cortesBorrador: null as { modo: HojasRutaAgeRangeMode; base: HojasRutaAgeRangeScope } | null };

export const useLienzoHojasRuta = create<EstadoLienzo>((set) => ({
  ...INICIAL,
  setBorrador: (borrador) => set({ borrador }),
  setRangosBorrador: (rangosBorrador) => set({ rangosBorrador }),
  setCortesBorrador: (cortesBorrador) => set({ cortesBorrador }),
  setMuestraBorrador: (muestraBorrador) => set({ muestraBorrador }),
  setSorteoBorrador: (sorteoBorrador) => set({ sorteoBorrador }),
  setDibujoArea: (dibujoArea) => set({ dibujoArea }),
  setSoloPorRevisar: (soloPorRevisar) => set({ soloPorRevisar }),
  setCapaMapa: (capaMapa) => set({ capaMapa }),
  setCajonPoblacion: (cajonPoblacion) => set({ cajonPoblacion }),
  setCajonMuestra: (cajonMuestra) => set({ cajonMuestra }),
  setZonaFiltro: (zonaFiltro) => set({ zonaFiltro }),
  setDistritoEnfocado: (distritoEnfocado) => set({ distritoEnfocado }),
  setBusquedaUmp: (busquedaUmp) => set({ busquedaUmp }),
  setBusquedaDistrito: (busquedaDistrito) => set({ busquedaDistrito }),
  setSoloElegidos: (soloElegidos) => set({ soloElegidos }),
  setDistritoBajoCursor: (distritoBajoCursor) => set((s) => (s.distritoBajoCursor === distritoBajoCursor ? s : { distritoBajoCursor })),
  reiniciar: () => set(INICIAL),
}));
