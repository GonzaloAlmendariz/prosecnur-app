// Estado UI efímero de las miniaturas del selector de láminas (la tarjeta enfocada y las de «Comparar»). Propio, ni el
// de la tira ni el del mazo: son láminas que aún no existen en el plan y no deben entrar en el avance ni en el anuncio
// de la tira. La caché real vive en el backend, por huella.

import { create } from "zustand";
import type { MiniaturasLote } from "../../../../api/graficosMiniaturas";
import {
  fallarLote, fusionarLote, marcarPedidas, olvidarPendientes, type Entradas, type LaminaClave, type LoteVigente,
} from "../miniaturas/loteMiniaturas";

type MiniaturasSelector = {
  entradas: Entradas;
  lotes: readonly LoteVigente[];
  /** Hay un `POST /miniaturas` sin responder: no se lanza otro hasta saber su lote. */
  enVuelo: boolean;
  pedir: (pedidas: readonly LaminaClave[]) => void;
  iniciarLote: (lote: LoteVigente) => void;
  aplicarLote: (lote: MiniaturasLote, src: (url: string) => string) => void;
  fallar: (claves: Record<string, string>, mensaje: string, loteId?: string) => void;
  /** Suelta los lotes vivos (al cerrar el selector): sus pendientes se olvidan. Devuelve sus jobs para cancelarlos. */
  abandonarLotes: () => string[];
  reiniciar: () => void;
};

export const useMiniaturasSelectorStore = create<MiniaturasSelector>((set, get) => ({
  entradas: {},
  lotes: [],
  enVuelo: false,
  pedir: (pedidas) => set((s) => ({ entradas: marcarPedidas(s.entradas, pedidas), enVuelo: true })),
  iniciarLote: (lote) => set((s) => ({ lotes: [...s.lotes.filter((l) => l.loteId !== lote.loteId), lote], enVuelo: false })),
  aplicarLote: (lote, src) => set((s) => {
    const propio = s.lotes.find((l) => l.loteId === lote.lote_id);
    if (!propio) return s;
    const entradas = fusionarLote(s.entradas, lote, propio, src);
    const sigue = lote.status === "running";
    if (entradas === s.entradas && sigue) return s;
    return sigue ? { entradas } : { entradas, lotes: s.lotes.filter((l) => l !== propio) };
  }),
  fallar: (claves, mensaje, loteId) => set((s) => ({
    entradas: fallarLote(s.entradas, { claves }, mensaje),
    ...(loteId ? { lotes: s.lotes.filter((l) => l.loteId !== loteId) } : {}),
    enVuelo: loteId ? s.enVuelo : false,
  })),
  abandonarLotes: () => {
    const { lotes, entradas } = get();
    if (!lotes.length) return [];
    set({ entradas: lotes.reduce((e, l) => olvidarPendientes(e, l.claves), entradas), lotes: [] });
    return lotes.map((l) => l.jobId).filter(Boolean);
  },
  reiniciar: () => set({ entradas: {}, lotes: [], enVuelo: false }),
}));
