// Estado UI efímero de «Revisar emparejado». Que el panel está abierto vive en la dirección (`panel`); el par confirmado
// vive en el payload de la lámina y la matriz en el backend. Aquí sólo el filtro, las sugerencias descartadas en la
// sesión, la fila que busca su par y la fase del guardado en la matriz.

import { create } from "zustand";
import type { FiltroEmparejado, UnionMatriz } from "./modeloEmparejado";

export type FaseGuardado =
  | { fase: "inactivo" }
  | { fase: "leyendo" }
  | { fase: "confirmar"; union: UnionMatriz }
  | { fase: "guardando" }
  | { fase: "error"; mensaje: string };

type EmparejadoUi = {
  filtro: FiltroEmparejado;
  /** `base$var` de las preguntas cuya sugerencia se descartó. */
  descartadas: Record<string, true>;
  /** La fila que está eligiendo su par con el buscador. */
  buscando: string | null;
  guardado: FaseGuardado;
  /** Al abrir: filtro, búsqueda y guardado de vuelta al inicio. Las sugerencias descartadas siguen descartadas. */
  preparar: () => void;
  filtrar: (filtro: FiltroEmparejado) => void;
  descartar: (clave: string) => void;
  buscar: (clave: string | null) => void;
  ponerGuardado: (guardado: FaseGuardado) => void;
};

export const useEmparejadoUi = create<EmparejadoUi>((set) => ({
  filtro: "todas",
  descartadas: {},
  buscando: null,
  guardado: { fase: "inactivo" },
  preparar: () => set({ filtro: "todas", buscando: null, guardado: { fase: "inactivo" } }),
  filtrar: (filtro) => set({ filtro, buscando: null }),
  descartar: (clave) => set((s) => ({ descartadas: { ...s.descartadas, [clave]: true }, buscando: s.buscando === clave ? null : s.buscando })),
  buscar: (buscando) => set({ buscando }),
  ponerGuardado: (guardado) => set({ guardado }),
}));
