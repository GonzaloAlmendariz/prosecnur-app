// Store del módulo Bitácora (ADR 0047).
//
// Patrón de `features/validacion/store.ts`: `create<T>()` sin middleware
// `persist`, contador `version` para invalidar lo derivado, y `resetForSession`
// para cuando cambia el proyecto abierto. La persistencia va al backend y al
// `.pulso`, nunca a localStorage.
//
// Este store guarda estado de INTERACCIÓN (qué fila está seleccionada, qué se
// está editando). El estado duro —el plan, las fases, las preferencias— vive en
// el payload consolidado y se rehidrata con `hidratar`.

import { create } from "zustand";

import type { BitacoraEstado, BitacoraFase } from "../../api/bitacora";

export type VistaCronograma = "fases" | "gantt" | "lista";

type BitacoraState = {
  estado: BitacoraEstado | null;
  /** Se bombea al rehidratar: los paneles que cachean derivados lo usan de key. */
  version: number;
  cargando: boolean;
  error: string | null;

  /** Fila del compositor abierta para editar fechas. */
  faseEnEdicion: BitacoraFase | null;
  tareaSeleccionada: string | null;
  /** Confirmación de borrado permanente en curso; nunca se borra en seco. */
  tareaPorBorrar: string | null;

  hidratar: (estado: BitacoraEstado) => void;
  setCargando: (cargando: boolean) => void;
  setError: (error: string | null) => void;
  editarFase: (fase: BitacoraFase | null) => void;
  seleccionarTarea: (id: string | null) => void;
  pedirBorrado: (id: string | null) => void;
  resetForSession: () => void;
};

const INICIAL = {
  estado: null,
  cargando: true,
  error: null,
  faseEnEdicion: null,
  tareaSeleccionada: null,
  tareaPorBorrar: null,
} as const;

export const useBitacoraStore = create<BitacoraState>((set) => ({
  ...INICIAL,
  version: 0,

  hidratar: (estado) =>
    set((s) => ({
      estado,
      version: s.version + 1,
      cargando: false,
      error: null,
      // Una confirmación de borrado no sobrevive a una rehidratación: el estado
      // que la motivó ya cambió y confirmarla a ciegas borraría otra cosa.
      tareaPorBorrar: null,
    })),

  setCargando: (cargando) => set({ cargando }),
  setError: (error) => set({ error, cargando: false }),
  editarFase: (faseEnEdicion) => set({ faseEnEdicion }),
  seleccionarTarea: (tareaSeleccionada) => set({ tareaSeleccionada }),
  pedirBorrado: (tareaPorBorrar) => set({ tareaPorBorrar }),

  resetForSession: () => set((s) => ({ ...INICIAL, version: s.version + 1 })),
}));
