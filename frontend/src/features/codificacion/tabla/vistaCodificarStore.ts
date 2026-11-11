import { create } from "zustand";
import type { OrdenTabla } from "./tablaCodificarModelo";

// Cómo se mira Codificar: en tarjetas o en tabla, y en qué orden van las filas de la tabla.
//
// Es estado de la interfaz y vive en memoria: `RespuestasCodificador` se vuelve a montar al cambiar de
// pregunta, y con un `useState` la vista elegida se perdía en cada cambio. Aquí dura lo que dura la
// ventana y no se escribe en la URL ni en el proyecto.

export type VistaCodificar = "tarjetas" | "tabla";

type EstadoVistaCodificar = {
  vista: VistaCodificar;
  orden: OrdenTabla;
  elegirVista: (vista: VistaCodificar) => void;
  elegirOrden: (orden: OrdenTabla) => void;
};

export const useVistaCodificar = create<EstadoVistaCodificar>((set) => ({
  vista: "tarjetas",
  orden: "frecuencia",
  elegirVista: (vista) => set({ vista }),
  elegirOrden: (orden) => set({ orden }),
}));
