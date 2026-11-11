import { create } from "zustand";
import type { FiltroPreguntas } from "./modeloUnidades";

// Cómo se mira Preguntas: qué filtro, qué búsqueda y qué unidad está en el inspector.
//
// Es estado de la interfaz y vive en memoria: dura lo que dura la ventana, así que al volver de Codificar
// la lista sigue donde se dejó. No se escribe en la URL ni en el proyecto.

type EstadoVistaPreguntas = {
  filtro: FiltroPreguntas;
  consulta: string;
  /** El `id` de la unidad seleccionada, o nada. */
  seleccion: string | null;
  elegirFiltro: (filtro: FiltroPreguntas) => void;
  buscar: (consulta: string) => void;
  seleccionar: (id: string | null) => void;
};

export const useVistaPreguntas = create<EstadoVistaPreguntas>((set) => ({
  // Lo que se codifica: pares y preguntas abiertas. Las cerradas sin texto aparecen en "Todas".
  filtro: "con-texto",
  consulta: "",
  seleccion: null,
  elegirFiltro: (filtro) => set({ filtro }),
  buscar: (consulta) => set({ consulta }),
  seleccionar: (seleccion) => set({ seleccion }),
}));
