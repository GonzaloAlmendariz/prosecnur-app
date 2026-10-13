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
};

export const APLICAR_ENTRADA_VACIA: AplicarEntrada = Object.freeze({
  aplicando: false,
  jobId: null,
  avisos: Object.freeze({ omitidas: [], textos_sin_codigo: [] }) as CodifAplicarAvisos,
  sinRecodificar: [],
  salida: null,
  error: "",
  enfocarPendiente: false,
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
        }),
      };
    }),
  fallar: (clave, mensaje) =>
    set((s) => ({
      porBase: actualizar(s.porBase, clave, { aplicando: false, jobId: null, error: mensaje }),
    })),
  terminar: (clave, salida) =>
    set((s) => ({ porBase: actualizar(s.porBase, clave, { jobId: null, salida }) })),
  cancelar: (clave) =>
    set((s) => ({ porBase: actualizar(s.porBase, clave, { jobId: null }) })),
  marcarEnfocado: (clave) =>
    set((s) => ({ porBase: actualizar(s.porBase, clave, { enfocarPendiente: false }) })),
  reset: () => set({ porBase: {} }),
}));

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
