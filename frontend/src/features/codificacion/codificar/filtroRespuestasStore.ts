import { create } from "zustand";
import type { FiltroDeRespuestas } from "./modeloDeCodificar";

// Qué respuestas se ven en Codificar: todas o solo las que faltan. Es estado de la interfaz y vive en
// memoria, como la vista elegida (`tabla/vistaCodificarStore.ts`): se conserva al pasar de pregunta y
// no se escribe en la URL ni en el proyecto.

type EstadoFiltroRespuestas = {
  filtro: FiltroDeRespuestas;
  elegirFiltro: (filtro: FiltroDeRespuestas) => void;
};

export const useFiltroRespuestas = create<EstadoFiltroRespuestas>((set) => ({
  filtro: "todas",
  elegirFiltro: (filtro) => set({ filtro }),
}));
