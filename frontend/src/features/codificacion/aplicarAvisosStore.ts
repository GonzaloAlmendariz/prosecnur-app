import { create } from "zustand";
import type {
  CodifAplicarAvisos,
  CodifSinRecodificar,
} from "../../api/codificacion";
import type { CodifAplicarRespuesta } from "../../api/dashboard";

// =============================================================================
// Store de la última aplicación de Codificación › Adaptar
// =============================================================================
// Al terminar el job de `/aplicar` se dispara `pulso:session-changed`; la
// página remonta el subárbol de Codificación y AdaptarPane se desmonta. Con su
// estado en `useState`, el aviso de lo que no se aplicó (ADR 0100, P1), lo que
// se entrega sin recodificar (ADR 0078) y las descargas desaparecían ~25 s
// después de pintarse. Aquí sobreviven al remontaje.
//
// Es estado UI efímero: el estado duro (catálogo, base adaptada) vive en el
// backend. Va keyed por sesión y base activa para que una base no muestre los
// avisos de otra ni un proyecto los del anterior.

export type AplicarSalida = { data: string; inst: string };

export type AplicarEntrada = {
  /** POST de `/aplicar` en curso (síncrono, 54–130 s medidos). */
  aplicando: boolean;
  /** Job de adaptación ya lanzado y todavía corriendo. */
  jobId: string | null;
  avisos: CodifAplicarAvisos;
  sinRecodificar: CodifSinRecodificar[];
  salida: AplicarSalida | null;
  error: string;
  /**
   * La respuesta recién llegó con avisos y nadie los llevó a la vista todavía.
   * Se consume una sola vez: remontar no vuelve a mover scroll ni foco.
   */
  enfocarPendiente: boolean;
  /**
   * Segundo pedido de llevar el aviso a la vista, para después del job. Se arma
   * al llegar la respuesta con avisos y lo consume `alMontar` en el primer
   * montaje con el job terminado: ese montaje es el remontaje que provoca el
   * propio `pulso:session-changed` del fin del job, que deja el scroll en 0 y
   * el foco en BODY. Un job que falla o se cancela lo desarma (no hay
   * remontaje que reparar) y un montaje con el job corriendo no lo toca.
   */
  revelarTrasJob: boolean;
};

export const APLICAR_ENTRADA_VACIA: AplicarEntrada = Object.freeze({
  aplicando: false,
  jobId: null,
  avisos: Object.freeze({ omitidas: [], textos_sin_codigo: [] }) as CodifAplicarAvisos,
  sinRecodificar: [],
  salida: null,
  error: "",
  enfocarPendiente: false,
  revelarTrasJob: false,
}) as AplicarEntrada;

export function claveAplicar(sessionId: string, base: string | null | undefined): string {
  const b = base && base.trim() ? base : "default";
  return `${sessionId}::${b}`;
}

export function tieneAvisos(avisos: CodifAplicarAvisos): boolean {
  return avisos.omitidas.length > 0 || avisos.textos_sin_codigo.length > 0;
}

type AplicarAvisosState = {
  porBase: Record<string, AplicarEntrada>;
  /** Pulsar «Adaptar»: borra lo de la aplicación anterior de esa base. */
  iniciar: (clave: string) => void;
  /** Respuesta del POST: avisos, sin recodificar y el job que arrancó. */
  recibir: (clave: string, r: CodifAplicarRespuesta) => void;
  fallar: (clave: string, mensaje: string) => void;
  terminar: (clave: string, salida: AplicarSalida) => void;
  cancelar: (clave: string) => void;
  marcarEnfocado: (clave: string) => void;
  /**
   * Montaje de la vista de Adaptar: si el job ya terminó y quedó armado el
   * pedido de revelar, lo convierte en `enfocarPendiente` y lo desarma. Una
   * sola vez; los montajes siguientes no mueven nada.
   */
  alMontar: (clave: string) => void;
  reset: () => void;
};

function actualizar(
  porBase: Record<string, AplicarEntrada>,
  clave: string,
  cambio: Partial<AplicarEntrada>,
): Record<string, AplicarEntrada> {
  const previa = porBase[clave] ?? APLICAR_ENTRADA_VACIA;
  return { ...porBase, [clave]: { ...previa, ...cambio } };
}

export const useAplicarAvisosStore = create<AplicarAvisosState>((set) => ({
  porBase: {},
  iniciar: (clave) =>
    set((s) => ({
      porBase: { ...s.porBase, [clave]: { ...APLICAR_ENTRADA_VACIA, aplicando: true } },
    })),
  recibir: (clave, r) =>
    set((s) => {
      const avisos: CodifAplicarAvisos = {
        omitidas: r.omitidas ?? [],
        textos_sin_codigo: r.textos_sin_codigo ?? [],
      };
      return {
        porBase: actualizar(s.porBase, clave, {
          aplicando: false,
          jobId: r.job_id,
          avisos,
          sinRecodificar: r.sin_recodificar ?? [],
          enfocarPendiente: tieneAvisos(avisos),
          revelarTrasJob: tieneAvisos(avisos),
        }),
      };
    }),
  fallar: (clave, mensaje) =>
    set((s) => ({
      porBase: actualizar(s.porBase, clave, {
        aplicando: false,
        jobId: null,
        error: mensaje,
        revelarTrasJob: false,
      }),
    })),
  terminar: (clave, salida) =>
    set((s) => ({ porBase: actualizar(s.porBase, clave, { jobId: null, salida }) })),
  cancelar: (clave) =>
    set((s) => ({ porBase: actualizar(s.porBase, clave, { jobId: null, revelarTrasJob: false }) })),
  marcarEnfocado: (clave) =>
    set((s) => ({ porBase: actualizar(s.porBase, clave, { enfocarPendiente: false }) })),
  alMontar: (clave) =>
    set((s) => {
      const e = s.porBase[clave];
      if (!e || !debeRevelarAlMontar(e)) return s;
      return {
        porBase: actualizar(s.porBase, clave, { enfocarPendiente: true, revelarTrasJob: false }),
      };
    }),
  reset: () => set({ porBase: {} }),
}));

/** Job terminado con éxito (hay descargas, nada corriendo) y pedido armado. */
export function debeRevelarAlMontar(e: AplicarEntrada): boolean {
  return e.revelarTrasJob && e.jobId === null && e.salida !== null && tieneAvisos(e.avisos);
}

/** Cuántos avisos de ADR 0100 dejó la aplicación (preguntas, no filas). */
export function contarAvisos(avisos: CodifAplicarAvisos): number {
  return avisos.omitidas.length + avisos.textos_sin_codigo.length;
}

export function selectAplicarEntrada(clave: string) {
  return (s: AplicarAvisosState): AplicarEntrada => s.porBase[clave] ?? APLICAR_ENTRADA_VACIA;
}

/**
 * Corre el POST de `/aplicar` y deja el resultado en el store. Vive fuera del
 * componente: si AdaptarPane se desmonta mientras el POST espera, la respuesta
 * igual llega a su base.
 */
export async function aplicarCodificacion(
  clave: string,
  llamar: () => Promise<CodifAplicarRespuesta>,
): Promise<void> {
  const store = useAplicarAvisosStore.getState();
  if (store.porBase[clave]?.aplicando) return;
  store.iniciar(clave);
  try {
    const r = await llamar();
    useAplicarAvisosStore.getState().recibir(clave, r);
  } catch (e) {
    useAplicarAvisosStore.getState().fallar(clave, (e as Error).message);
  }
}
