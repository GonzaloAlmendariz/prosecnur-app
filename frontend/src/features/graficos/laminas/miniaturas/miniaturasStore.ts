// Estado UI efímero de las miniaturas en lote (F6 §5.3). La caché real vive en el backend (por huella, en la sesión);
// aquí sólo lo que la tira recuerda mientras la app está abierta: qué se pidió con qué clave, qué llegó y los lotes vivos.
// Se vacía al cambiar de sesión (las URLs de imagen llevan el sid).
//
// Pueden convivir varios lotes (una lámina nueva no cancela el lote en curso: `loteMiniaturas.ts`, `planPedido`). Cada
// lámina viva está en un solo lote: los no-reemplazantes sólo llevan láminas sin entrada y un reemplazante descarta a
// todos los anteriores (el backend los cancela). `vigente` es la vista agregada que leen el anuncio y el avance.

import { create } from "zustand";
import {
  agregarVigente, fallarLote, fusionarLote, marcarPedidas, olvidarPendientes,
  type Entradas, type LaminaClave, type LoteVigente,
} from "./loteMiniaturas";
import type { MiniaturasLote } from "../../../../api/graficosMiniaturas";

type MiniaturasStore = {
  entradas: Entradas;
  /** Lotes vivos, en orden de lanzamiento. */
  lotes: readonly LoteVigente[];
  /** Unión de los lotes vivos (`agregarVigente`); null si no corre ninguno. */
  vigente: LoteVigente | null;
  /** Ids que «Reintentar» pidió rehacer aunque su clave no haya cambiado. */
  forzadas: Record<string, true>;
  /** Hay un `POST /miniaturas` sin responder: no se lanza otro hasta saber su lote. */
  enVuelo: boolean;
  pedir: (pedidas: readonly LaminaClave[]) => void;
  /** Registra el lote recién lanzado; `reemplazo`: el pedido llevaba `reemplazar = true` y el backend canceló los demás. */
  iniciarLote: (lote: LoteVigente, opciones?: { reemplazo?: boolean }) => void;
  aplicarLote: (lote: MiniaturasLote, src: (url: string) => string) => void;
  /** Falla un pedido (sin `loteId`: el POST) o un lote entero (con `loteId`: su poll), que deja de estar vivo. */
  fallar: (claves: Record<string, string>, mensaje: string, loteId?: string) => void;
  reintentar: (id: string) => void;
  /** Suelta los lotes vivos (al salir de Láminas): sus pendientes se olvidan para volver a pedirse. Devuelve sus jobs. */
  abandonarLotes: () => string[];
  reiniciar: () => void;
};

const conLotes = (lotes: readonly LoteVigente[]) => ({ lotes, vigente: agregarVigente(lotes) });

export const useMiniaturasLoteStore = create<MiniaturasStore>((set, get) => ({
  entradas: {},
  lotes: [],
  vigente: null,
  forzadas: {},
  enVuelo: false,
  pedir: (pedidas) => set((s) => {
    const forzadas = { ...s.forzadas };
    for (const p of pedidas) delete forzadas[p.id];
    return { entradas: marcarPedidas(s.entradas, pedidas), forzadas, enVuelo: true };
  }),
  iniciarLote: (lote, opciones) => set((s) => ({
    ...conLotes(opciones?.reemplazo ? [lote] : [...s.lotes.filter((l) => l.loteId !== lote.loteId), lote]),
    enVuelo: false,
  })),
  aplicarLote: (lote, src) => set((s) => {
    const propio = s.lotes.find((l) => l.loteId === lote.lote_id);
    if (!propio) return s;
    const entradas = fusionarLote(s.entradas, lote, propio, src);
    const sigue = lote.status === "running";
    if (entradas === s.entradas && sigue) return s;
    return sigue ? { entradas } : { entradas, ...conLotes(s.lotes.filter((l) => l !== propio)) };
  }),
  fallar: (claves, mensaje, loteId) => set((s) => ({
    entradas: fallarLote(s.entradas, { claves }, mensaje),
    ...(loteId ? conLotes(s.lotes.filter((l) => l.loteId !== loteId)) : {}),
    enVuelo: loteId ? s.enVuelo : false,
  })),
  reintentar: (id) => set((s) => ({ forzadas: { ...s.forzadas, [id]: true } })),
  abandonarLotes: () => {
    const { lotes, entradas } = get();
    if (!lotes.length) return [];
    set({ entradas: lotes.reduce((e, l) => olvidarPendientes(e, l.claves), entradas), ...conLotes([]) });
    return lotes.map((l) => l.jobId).filter(Boolean);
  },
  reiniciar: () => set({ entradas: {}, ...conLotes([]), forzadas: {}, enVuelo: false }),
}));
