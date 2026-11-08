// Estado UI efímero de «Elegir cifra» (ElegirCifra.tsx). Sólo uno abierto a la vez: el de la fila `abierta`. El orden
// se conserva entre filas y entre aperturas (el analista lo eligió una vez); la búsqueda y la opción activa no.

import { create } from "zustand";
import type { OrdenCifras } from "./modeloElegirCifra";

type ElegirCifraUi = {
  /** La clave de la fila del cierre con el control abierto; `null` si ninguno. */
  abierta: string | null;
  busqueda: string;
  orden: OrdenCifras;
  /** La opción resaltada (`lamina|clave`); `null` antes de recorrer con el teclado. */
  activa: string | null;
  abrir: (fila: string, activa: string | null) => void;
  cerrar: () => void;
  buscar: (texto: string) => void;
  ordenar: (orden: OrdenCifras) => void;
  activar: (id: string | null) => void;
};

export const useElegirCifraUi = create<ElegirCifraUi>((set) => ({
  abierta: null,
  busqueda: "",
  orden: "valor",
  activa: null,
  abrir: (fila, activa) => set({ abierta: fila, busqueda: "", activa }),
  cerrar: () => set({ abierta: null, busqueda: "", activa: null }),
  buscar: (busqueda) => set({ busqueda, activa: null }),
  ordenar: (orden) => set({ orden }),
  activar: (activa) => set({ activa }),
}));
