// Poll de `GET /api/graficos/miniaturas/<lote_id>` (contrato §2.4): trae el estado lámina por lámina también a medias, así
// que la tira se pinta conforme llegan sin esperar al `done`. Mismo endurecimiento que `iniciarJobPoll` (hooks/useJob):
// reintentos con backoff ante fallos transitorios (Plumber mono-hilo puede tardar en contestar), corte claro ante 404
// repetidos (backend reiniciado) y parada sin emisiones tardías. Dependencias inyectables: tests en pollLote.test.ts.

import { ApiError } from "../../../../api/core";
import type { MiniaturasLote } from "../../../../api/graficosMiniaturas";

export type ActualizacionLote =
  | { tipo: "estado"; lote: MiniaturasLote }
  | { tipo: "fallo"; mensaje: string };

type TimerId = ReturnType<typeof setTimeout>;

export type DepsPollLote = {
  leer: (loteId: string) => Promise<MiniaturasLote>;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => TimerId;
  clearTimer?: (id: TimerId) => void;
  maxTransitorios?: number;
  maxNoExiste?: number;
};

export const MENSAJE_LOTE_PERDIDO = "El backend se reinició y las miniaturas pendientes se perdieron.";
export const MENSAJE_LOTE_INALCANZABLE = "No se pudo consultar el avance de las miniaturas.";

const noExiste = (e: unknown) => e instanceof ApiError
  && (e.code === "E_MINIATURAS_LOTE_NO_EXISTE" || e.code === "E_NOT_FOUND" || e.code === "HTTP_404");

/** Cadencia: rápida al principio (las cacheadas llegan enseguida), luego una lámina tarda ~6 s. */
export function esperaPoll(transcurrido: number): number {
  return transcurrido < 10_000 ? 600 : transcurrido < 60_000 ? 1500 : 3000;
}

export function iniciarPollLote(loteId: string, onUpdate: (u: ActualizacionLote) => void, deps: DepsPollLote): () => void {
  const now = deps.now ?? Date.now;
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((id: TimerId) => clearTimeout(id));
  const maxTransitorios = deps.maxTransitorios ?? 5;
  const maxNoExiste = deps.maxNoExiste ?? 3;
  const inicio = now();
  let parado = false;
  let timer: TimerId | null = null;
  let transitorios = 0;
  let ausentes = 0;

  const emitir = (u: ActualizacionLote) => { if (!parado) onUpdate(u); };

  const poll = async () => {
    if (parado) return;
    try {
      const lote = await deps.leer(loteId);
      if (parado) return;
      transitorios = 0;
      ausentes = 0;
      emitir({ tipo: "estado", lote });
      if (lote.status === "running") timer = setTimer(poll, esperaPoll(now() - inicio));
    } catch (e) {
      if (parado) return;
      if (noExiste(e)) {
        ausentes += 1;
        if (ausentes >= maxNoExiste) { emitir({ tipo: "fallo", mensaje: MENSAJE_LOTE_PERDIDO }); return; }
      } else {
        transitorios += 1;
        if (transitorios >= maxTransitorios) { emitir({ tipo: "fallo", mensaje: MENSAJE_LOTE_INALCANZABLE }); return; }
      }
      timer = setTimer(poll, Math.min(1000 * 2 ** (Math.max(transitorios, ausentes) - 1), 8000));
    }
  };
  void poll();

  return () => {
    parado = true;
    if (timer != null) clearTimer(timer);
  };
}
