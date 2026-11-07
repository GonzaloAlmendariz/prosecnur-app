import { create } from "zustand";
import type { EstadoGeneracion } from "./tipos";

// Bandeja «Entregables»: lo generado en esta sesión de la app.
// =============================================================================
// Estado UI efímero (no se guarda en el .pulso ni en el backend): cada
// generación que arranca `useGeneracion` deja aquí una entrada y la va
// actualizando, aunque la pantalla que la pidió ya se haya desmontado. Así el
// resultado de un job lento no se pierde si el usuario cambió de pestaña.
// Al cambiar de sesión (otro proyecto) la bandeja se vacía.

export type EstadoEnBandeja = Exclude<EstadoGeneracion, { fase: "inactiva" }>;

export type EntradaBandeja = {
  id: string;
  modulo: string | null;
  estado: EstadoEnBandeja;
  /** Marca de tiempo del arranque (ms). */
  inicio: number;
};

/** Cuántas entradas conserva la bandeja; las más viejas salen primero. */
export const MAX_ENTRADAS_BANDEJA = 30;

type BandejaState = {
  /** La más reciente primero. */
  entradas: EntradaBandeja[];
  registrar: (entrada: EntradaBandeja) => void;
  actualizar: (id: string, estado: EstadoEnBandeja) => void;
  quitar: (id: string) => void;
  vaciar: () => void;
};

export const useBandejaEntregables = create<BandejaState>((set) => ({
  entradas: [],
  registrar: (entrada) =>
    set((s) => ({
      entradas: [entrada, ...s.entradas.filter((e) => e.id !== entrada.id)].slice(0, MAX_ENTRADAS_BANDEJA),
    })),
  actualizar: (id, estado) =>
    set((s) => ({
      entradas: s.entradas.some((e) => e.id === id)
        ? s.entradas.map((e) => (e.id === id ? { ...e, estado } : e))
        : s.entradas,
    })),
  quitar: (id) => set((s) => ({ entradas: s.entradas.filter((e) => e.id !== id) })),
  vaciar: () => set({ entradas: [] }),
}));

export type ResumenBandeja = {
  total: number;
  /** El estado que pinta el punto del botón: lo que esté en curso manda, luego un fallo. */
  punto: "inactiva" | "en_curso" | "lista" | "fallo";
};

export function resumenBandeja(entradas: readonly EntradaBandeja[]): ResumenBandeja {
  const fases = new Set(entradas.map((e) => e.estado.fase));
  const punto = fases.has("en_curso") ? "en_curso" : entradas[0]?.estado.fase === "fallo" ? "fallo" : entradas.length ? "lista" : "inactiva";
  return { total: entradas.length, punto };
}
