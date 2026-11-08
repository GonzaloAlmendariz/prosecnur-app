// Estado UI efímero de «Revisar emparejado». Que el panel está abierto vive en la dirección (`panel`); el par confirmado
// vive en el payload de la lámina y la matriz en el backend. Aquí sólo los filtros (estado y coincidencia), las sugerencias descartadas en la
// sesión, la fila que busca su par, la fila activa (la que muestra su evidencia y recibe el teclado) y la fase del
// guardado en la matriz.

import { create } from "zustand";
import type { FiltroCoincidencia } from "./coincidencia";
import type { FiltroEmparejado, UnionMatriz } from "./modeloEmparejado";

export type FaseGuardado =
  | { fase: "inactivo" }
  | { fase: "leyendo" }
  | { fase: "confirmar"; union: UnionMatriz }
  | { fase: "guardando" }
  | { fase: "error"; mensaje: string };

type EmparejadoUi = {
  filtro: FiltroEmparejado;
  /** El filtro por coincidencia del par (Idéntico, Parecido, Distinto), encima del filtro por estado. */
  coincidencia: FiltroCoincidencia;
  /** `base$var` de las preguntas cuya sugerencia se descartó. */
  descartadas: Record<string, true>;
  /** La fila que está eligiendo su par con el buscador. */
  buscando: string | null;
  /** La fila activa: su evidencia se ve abajo y J, K, Enter y X actúan sobre ella. */
  activa: string | null;
  guardado: FaseGuardado;
  /** El aviso del último lote (E6): cuántas filas perdieron su sugerencia porque su par se confirmó con otra. */
  avisoLote: string | null;
  /** Al abrir: filtro, búsqueda y guardado de vuelta al inicio. Las sugerencias descartadas siguen descartadas. */
  preparar: () => void;
  filtrar: (filtro: FiltroEmparejado) => void;
  filtrarCoincidencia: (coincidencia: FiltroCoincidencia) => void;
  descartar: (clave: string) => void;
  buscar: (clave: string | null) => void;
  activar: (clave: string | null) => void;
  ponerGuardado: (guardado: FaseGuardado) => void;
  ponerAvisoLote: (aviso: string | null) => void;
};

export const useEmparejadoUi = create<EmparejadoUi>((set) => ({
  filtro: "todas",
  coincidencia: "todas",
  descartadas: {},
  buscando: null,
  activa: null,
  guardado: { fase: "inactivo" },
  avisoLote: null,
  preparar: () => set({ filtro: "todas", coincidencia: "todas", buscando: null, activa: null, guardado: { fase: "inactivo" }, avisoLote: null }),
  filtrar: (filtro) => set({ filtro, buscando: null }),
  filtrarCoincidencia: (coincidencia) => set({ coincidencia, buscando: null }),
  descartar: (clave) => set((s) => ({ descartadas: { ...s.descartadas, [clave]: true }, buscando: s.buscando === clave ? null : s.buscando })),
  buscar: (buscando) => set({ buscando }),
  activar: (activa) => set({ activa }),
  ponerGuardado: (guardado) => set({ guardado }),
  ponerAvisoLote: (avisoLote) => set({ avisoLote }),
}));
