// Líneas visuales propias de la app (ID3, decisión D7): lo que la biblioteca de Identidad lista, guarda y borra. Viven
// en la app (no en el estudio), así que este store es de la vista y se carga una vez por sesión de la app; guardar o
// borrar actualiza la lista con lo que devuelve el servidor.

import { create } from "zustand";
import {
  apiGraficosEliminarLineaVisual,
  apiGraficosGuardarLineaVisual,
  apiGraficosLineasVisuales,
  type LineaVisualNueva,
  type LineaVisualPropia,
} from "../../../api/graficosLineasVisuales";

import type { PptStyleProfileMeta } from "../../../api/graficos";

/** Qué hace el diálogo de líneas: guardar lo actual como nueva, editar una propia, duplicar una o eliminar una propia. */
export type EdicionLinea =
  | { modo: "nueva" }
  | { modo: "editar"; linea: LineaVisualPropia }
  | { modo: "duplicar"; base: PptStyleProfileMeta }
  | { modo: "eliminar"; linea: LineaVisualPropia };

type LineasPropiasStore = {
  /** El diálogo abierto (efímero: una acción sobre una línea, no una vista enlazable). */
  edicion: EdicionLinea | null;
  setEdicion: (e: EdicionLinea | null) => void;
  lineas: LineaVisualPropia[];
  cargadas: boolean;
  error: string;
  cargar: () => Promise<void>;
  guardar: (id: string, linea: LineaVisualNueva) => Promise<LineaVisualPropia>;
  eliminar: (id: string) => Promise<void>;
};

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error && e.message ? e.message : porDefecto);

export const useLineasPropias = create<LineasPropiasStore>((set, get) => ({
  edicion: null,
  setEdicion: (edicion) => set({ edicion }),
  lineas: [],
  cargadas: false,
  error: "",
  cargar: async () => {
    try {
      set({ lineas: await apiGraficosLineasVisuales(), cargadas: true, error: "" });
    } catch (e) {
      set({ cargadas: true, error: mensaje(e, "No se pudieron leer tus líneas visuales.") });
    }
  },
  guardar: async (id, linea) => {
    const guardada = await apiGraficosGuardarLineaVisual(id, linea);
    const resto = get().lineas.filter((l) => l.id !== id);
    set({ lineas: [...resto, guardada].sort((a, b) => a.titulo_humano.localeCompare(b.titulo_humano, "es")), error: "" });
    return guardada;
  },
  eliminar: async (id) => {
    await apiGraficosEliminarLineaVisual(id);
    set({ lineas: get().lineas.filter((l) => l.id !== id) });
  },
}));
