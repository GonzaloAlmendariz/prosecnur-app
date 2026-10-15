// Estado UI efímero de la Vista general (F6.3). El plan vive en `usePlanStore` y en el backend; aquí sólo lo que la vista
// recuerda mientras está abierta: la selección (por id), qué se arrastra y dónde caería, la confirmación de eliminar y
// el último anuncio para lectores de pantalla.

import { create } from "zustand";
import type { Arrastre, MarcaSoltar } from "./modeloVistaGeneral";
import type { FiltroInforme } from "./estadoTarjetas";
import { SELECCION_VACIA, type SeleccionVistaGeneral } from "./seleccionVistaGeneral";

type VistaGeneralStore = {
  seleccion: SeleccionVistaGeneral;
  arrastre: Arrastre | null;
  marca: MarcaSoltar | null;
  /** Ids que pide eliminar el diálogo de confirmación; null = cerrado. */
  confirmarEliminar: string[] | null;
  anuncio: string;
  /** I3: qué tarjetas resalta el resumen clicable; las demás se atenúan. */
  filtro: FiltroInforme;
  setFiltro: (f: FiltroInforme) => void;
  /** I5: capítulos y bloques plegados (por id de fila). */
  plegados: ReadonlySet<string>;
  alternarPlegado: (filaId: string) => void;
  setSeleccion: (s: SeleccionVistaGeneral) => void;
  setArrastre: (a: Arrastre | null) => void;
  setMarca: (m: MarcaSoltar | null) => void;
  setConfirmarEliminar: (ids: string[] | null) => void;
  anunciar: (texto: string) => void;
};

const mismaMarca = (a: MarcaSoltar | null, b: MarcaSoltar | null) => JSON.stringify(a) === JSON.stringify(b);

export const useVistaGeneralUi = create<VistaGeneralStore>((set) => ({
  seleccion: SELECCION_VACIA,
  arrastre: null,
  marca: null,
  confirmarEliminar: null,
  anuncio: "",
  filtro: "todas",
  setFiltro: (filtro) => set({ filtro }),
  plegados: new Set<string>(),
  alternarPlegado: (filaId) => set((s) => {
    const plegados = new Set(s.plegados);
    if (!plegados.delete(filaId)) plegados.add(filaId);
    return { plegados };
  }),
  setSeleccion: (seleccion) => set((s) => (s.seleccion === seleccion ? s : { seleccion })),
  setArrastre: (arrastre) => set(arrastre ? { arrastre } : { arrastre: null, marca: null }),
  setMarca: (marca) => set((s) => (mismaMarca(s.marca, marca) ? s : { marca })),
  setConfirmarEliminar: (confirmarEliminar) => set({ confirmarEliminar }),
  // El mismo texto dos veces seguidas no se vuelve a leer: un espacio sin ancho fuerza el cambio.
  anunciar: (texto) => set((s) => ({ anuncio: s.anuncio === texto ? `${texto}​` : texto })),
}));
