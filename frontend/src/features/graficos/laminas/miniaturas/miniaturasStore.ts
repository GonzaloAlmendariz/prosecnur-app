// Estado UI efímero de las miniaturas en lote (F6 §5.3). La caché real vive en el backend (por huella, en la sesión);
// aquí sólo lo que la tira recuerda mientras la app está abierta: qué se pidió con qué clave, qué llegó y el lote vigente.
// Se vacía al cambiar de sesión (las URLs de imagen llevan el sid).

import { create } from "zustand";
import { fallarLote, fusionarLote, marcarPedidas, olvidarPendientes, type Entradas, type LaminaClave, type LoteVigente } from "./loteMiniaturas";
import type { MiniaturasLote } from "../../../../api/graficosMiniaturas";

type MiniaturasStore = {
  entradas: Entradas;
  vigente: LoteVigente | null;
  /** Ids que «Reintentar» pidió rehacer aunque su clave no haya cambiado. */
  forzadas: Record<string, true>;
  /** Hay un `POST /miniaturas` sin responder: no se lanza otro hasta saber su lote. */
  enVuelo: boolean;
  pedir: (pedidas: readonly LaminaClave[]) => void;
  iniciarLote: (vigente: LoteVigente) => void;
  aplicarLote: (lote: MiniaturasLote, src: (url: string) => string) => void;
  fallar: (claves: Record<string, string>, mensaje: string) => void;
  reintentar: (id: string) => void;
  /** Suelta el lote vigente (al salir de Láminas): sus pendientes se olvidan para volver a pedirse. Devuelve su job. */
  abandonarLote: () => string | null;
  reiniciar: () => void;
};

export const useMiniaturasLoteStore = create<MiniaturasStore>((set, get) => ({
  entradas: {},
  vigente: null,
  forzadas: {},
  enVuelo: false,
  pedir: (pedidas) => set((s) => {
    const forzadas = { ...s.forzadas };
    for (const p of pedidas) delete forzadas[p.id];
    return { entradas: marcarPedidas(s.entradas, pedidas), forzadas, enVuelo: true };
  }),
  iniciarLote: (vigente) => set({ vigente, enVuelo: false }),
  aplicarLote: (lote, src) => set((s) => {
    if (!s.vigente || s.vigente.loteId !== lote.lote_id) return s;
    const entradas = fusionarLote(s.entradas, lote, s.vigente, src);
    const vigente = lote.status === "running" ? s.vigente : null;
    return entradas === s.entradas && vigente === s.vigente ? s : { entradas, vigente };
  }),
  fallar: (claves, mensaje) => set((s) => ({ entradas: fallarLote(s.entradas, { claves }, mensaje), vigente: null, enVuelo: false })),
  reintentar: (id) => set((s) => ({ forzadas: { ...s.forzadas, [id]: true } })),
  abandonarLote: () => {
    const { vigente, entradas } = get();
    if (!vigente) return null;
    set({ entradas: olvidarPendientes(entradas, vigente.claves), vigente: null });
    return vigente.jobId || null;
  },
  reiniciar: () => set({ entradas: {}, vigente: null, forzadas: {}, enVuelo: false }),
}));
