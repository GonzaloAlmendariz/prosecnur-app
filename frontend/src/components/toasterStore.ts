// Toaster global (ADR 0047).
//
// La app no tenía uno: el único deck de avisos efímeros vivía dentro de
// `xlsformEditor/canvas-graph/LogicCanvas.tsx` con su propio `useState`, así que
// cualquier otra superficie que quisiera confirmar una acción tenía que
// inventar el suyo o quedarse muda.
//
// Store y no Context a propósito: montar un Provider obligaría a envolver el
// árbol y a que cada consumidor sea descendiente. Con un store, un engine o un
// handler llama `toast.exito(...)` sin ser un componente ni estar dentro de
// nada. Es el mismo patrón con el que la app ya monta hosts globales.
//
// Sin middleware `persist`: un toast es efímero por definición y sobrevivir a
// un reload sería un bug, no una función.

import { create } from "zustand";

export type TonoToast = "info" | "exito" | "error" | "aviso";

export type Toast = {
  id: string;
  tono: TonoToast;
  mensaje: string;
  /** Segunda línea opcional: el detalle que no cabe en el título. */
  detalle?: string;
  /** Acción única. Un toast con dos botones ya es un diálogo. */
  accion?: { label: string; onSelect: () => void };
  /** ms hasta el auto-cierre. 0 = no se cierra solo. */
  duracion: number;
};

/**
 * Tope simultáneo.
 *
 * Existe por el caso que el ADR 0047 llama "cascada": abrir la app tras una
 * semana cerrada produce decenas de avisos vencidos a la vez. Ese caso se
 * resuelve con UN toast agregado que abre el centro de avisos; el tope de tres
 * es la red por si algo más los emite en ráfaga.
 */
export const MAX_TOASTS = 3;

const DURACION_POR_TONO: Record<TonoToast, number> = {
  info: 4000,
  exito: 3200,
  aviso: 6000,
  // Un error no se va solo: si desaparece antes de que el usuario lo lea, el
  // error existió y nadie se enteró.
  error: 0,
};

type ToasterState = {
  toasts: Toast[];
  emitir: (toast: Omit<Toast, "id" | "duracion"> & { duracion?: number }) => string;
  cerrar: (id: string) => void;
  limpiar: () => void;
};

let secuencia = 0;
function siguienteId(): string {
  secuencia += 1;
  return `toast-${secuencia}`;
}

export const useToasterStore = create<ToasterState>((set) => ({
  toasts: [],

  emitir: ({ tono, mensaje, detalle, accion, duracion }) => {
    const id = siguienteId();
    const toast: Toast = {
      id,
      tono,
      mensaje,
      detalle,
      accion,
      duracion: duracion ?? DURACION_POR_TONO[tono],
    };
    set((s) => ({
      // El más nuevo primero, y el desborde se descarta por antigüedad: lo que
      // acaba de pasar importa más que lo que pasó hace cuatro segundos.
      toasts: [toast, ...s.toasts].slice(0, MAX_TOASTS),
    }));
    return id;
  },

  cerrar: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  limpiar: () => set({ toasts: [] }),
}));

/**
 * Fachada para emitir desde cualquier parte, sin hooks ni Provider.
 *
 *   toast.exito("Cronograma guardado")
 *   toast.error("No se pudo guardar", { detalle: err.message })
 */
export const toast = {
  info: (mensaje: string, extra?: Partial<Pick<Toast, "detalle" | "accion" | "duracion">>) =>
    useToasterStore.getState().emitir({ tono: "info", mensaje, ...extra }),
  exito: (mensaje: string, extra?: Partial<Pick<Toast, "detalle" | "accion" | "duracion">>) =>
    useToasterStore.getState().emitir({ tono: "exito", mensaje, ...extra }),
  aviso: (mensaje: string, extra?: Partial<Pick<Toast, "detalle" | "accion" | "duracion">>) =>
    useToasterStore.getState().emitir({ tono: "aviso", mensaje, ...extra }),
  error: (mensaje: string, extra?: Partial<Pick<Toast, "detalle" | "accion" | "duracion">>) =>
    useToasterStore.getState().emitir({ tono: "error", mensaje, ...extra }),
  cerrar: (id: string) => useToasterStore.getState().cerrar(id),
  limpiar: () => useToasterStore.getState().limpiar(),
};
