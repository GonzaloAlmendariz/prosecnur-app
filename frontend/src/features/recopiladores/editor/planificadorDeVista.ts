/**
 * Cuándo se pide la página real y qué se hace con la respuesta (E1b).
 *
 * Dibujar una página cuesta 250–400 ms y Plumber atiende en serie, así que una
 * ráfaga de teclas no puede volverse una ráfaga de dibujos:
 *
 * - **espera**: cada pedido espera 350 ms; uno nuevo reinicia la espera;
 * - **turno**: sólo la respuesta del último pedido se aplica; las viejas se
 *   descartan aunque lleguen después;
 * - **AbortController**: el pedido anterior se cancela al lanzar otro;
 * - **caché en memoria** por (huella del borrador, unidad, página, dpi): volver
 *   a una cara o deshacer una edición no vuelve a dibujar;
 * - **la otra cara, perezosa**: con la cara activa lista se dibujan las demás
 *   en segundo plano, una a una, y se cancelan si llega un pedido de verdad;
 * - **la imagen anterior se queda** marcada «desactualizada» si un pedido
 *   falla: un error no deja el escenario en blanco.
 *
 * No depende de React: el hook `useVistaDelPliego` sólo lo conecta.
 */

import {
  MaterialPreviewError,
  PREVIEW_PAGE,
  PREVIEW_TEMPLATE_INVALID,
  PREVIEW_UNAVAILABLE,
  PREVIEW_UNIT,
  type MaterialPreview,
  type MaterialPreviewProblem,
  type MaterialPreviewRequest,
} from "../../../api/materialPreview";

export const ESPERA_DE_VISTA_MS = 350;
const TOPE_DE_CACHE = 48;

export type FalloDeVista = {
  tipo: "invalida" | "no-disponible" | "unidad" | "pagina" | "error";
  mensaje: string;
  problemas: MaterialPreviewProblem[];
};

export type EstadoDeVista = {
  /** La última página dibujada (puede ser de otra cara o de otro borrador). */
  vista: MaterialPreview | null;
  /** Clave del pedido al que corresponde `vista`. */
  claveDeVista: string | null;
  /** Hay un pedido en espera o en vuelo. */
  cargando: boolean;
  /** El último pedido falló y `vista` ya no refleja el borrador. */
  desactualizada: boolean;
  fallo: FalloDeVista | null;
};

export const ESTADO_INICIAL_DE_VISTA: EstadoDeVista = {
  vista: null,
  claveDeVista: null,
  cargando: false,
  desactualizada: false,
  fallo: null,
};

export type PedidoDeVista = { clave: string; request: MaterialPreviewRequest };

export type PedirVista = (request: MaterialPreviewRequest, signal: AbortSignal) => Promise<MaterialPreview>;

function esCancelacion(cause: unknown): boolean {
  return cause instanceof Error && cause.name === "AbortError";
}

function mensajeDe(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/** Cómo se lee cada rechazo del endpoint. */
export function clasificarFallo(cause: unknown): FalloDeVista {
  if (cause instanceof MaterialPreviewError) {
    if (cause.code === PREVIEW_TEMPLATE_INVALID) {
      return { tipo: "invalida", mensaje: "Hay bloques por corregir: están marcados en la lista.", problemas: cause.problems };
    }
    if (cause.code === PREVIEW_UNAVAILABLE || cause.status === 503) {
      return { tipo: "no-disponible", mensaje: "La página no se puede dibujar ahora.", problemas: [] };
    }
    if (cause.code === PREVIEW_UNIT || cause.status === 404) {
      return { tipo: "unidad", mensaje: "Esa unidad ya no está en el plan.", problemas: [] };
    }
    if (cause.code === PREVIEW_PAGE) {
      return { tipo: "pagina", mensaje: "Esa cara ya no está en la receta.", problemas: [] };
    }
  }
  return { tipo: "error", mensaje: mensajeDe(cause, "No se pudo dibujar la página."), problemas: [] };
}

export function claveDePedido(opts: { huella: string; unidad: string | null; page: number; dpi: number }): string {
  return `${opts.huella}|${opts.unidad ?? ""}|p${opts.page}|${opts.dpi}`;
}

export type PlanificadorDeVista = {
  /** Pide la página. Con `inmediato` no espera (primer dibujo). */
  solicitar: (pedido: PedidoDeVista, opts?: { inmediato?: boolean }) => void;
  /** Dibuja en segundo plano, en orden, lo que no esté en caché. */
  precargar: (pedidos: readonly PedidoDeVista[]) => void;
  enCache: (clave: string) => MaterialPreview | undefined;
  estado: () => EstadoDeVista;
  destruir: () => void;
};

export function crearPlanificadorDeVista(opts: {
  pedir: PedirVista;
  alCambiar: (estado: EstadoDeVista) => void;
  /** Avisado cuando el pedido vigente quedó listo (para precargar lo demás). */
  alListo?: (pedido: PedidoDeVista, vista: MaterialPreview) => void;
  esperaMs?: number;
}): PlanificadorDeVista {
  const espera = opts.esperaMs ?? ESPERA_DE_VISTA_MS;
  const cache = new Map<string, MaterialPreview>();
  let estado = ESTADO_INICIAL_DE_VISTA;
  let turno = 0;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let enVuelo: AbortController | null = null;
  let precarga: AbortController | null = null;
  let vivo = true;

  const poner = (siguiente: EstadoDeVista) => {
    estado = siguiente;
    if (vivo) opts.alCambiar(estado);
  };

  const recordar = (clave: string, vista: MaterialPreview) => {
    cache.delete(clave);
    cache.set(clave, vista);
    while (cache.size > TOPE_DE_CACHE) {
      const masVieja = cache.keys().next().value;
      if (masVieja === undefined) break;
      cache.delete(masVieja);
    }
  };

  const cancelarPrecarga = () => {
    precarga?.abort();
    precarga = null;
  };

  const solicitar: PlanificadorDeVista["solicitar"] = (pedido, extra = {}) => {
    turno += 1;
    const mio = turno;
    if (temporizador !== null) clearTimeout(temporizador);
    temporizador = null;
    enVuelo?.abort();
    enVuelo = null;

    const guardada = cache.get(pedido.clave);
    if (guardada) {
      recordar(pedido.clave, guardada);
      poner({ vista: guardada, claveDeVista: pedido.clave, cargando: false, desactualizada: false, fallo: null });
      opts.alListo?.(pedido, guardada);
      return;
    }

    cancelarPrecarga();
    poner({ ...estado, cargando: true });
    const lanzar = () => {
      temporizador = null;
      const control = new AbortController();
      enVuelo = control;
      opts.pedir(pedido.request, control.signal).then(
        (vista) => {
          if (mio !== turno || !vivo) return;
          enVuelo = null;
          recordar(pedido.clave, vista);
          poner({ vista, claveDeVista: pedido.clave, cargando: false, desactualizada: false, fallo: null });
          opts.alListo?.(pedido, vista);
        },
        (cause: unknown) => {
          if (mio !== turno || !vivo || esCancelacion(cause)) return;
          enVuelo = null;
          poner({ ...estado, cargando: false, desactualizada: estado.vista !== null, fallo: clasificarFallo(cause) });
        },
      );
    };
    if (extra.inmediato) lanzar();
    else temporizador = setTimeout(lanzar, espera);
  };

  const precargar: PlanificadorDeVista["precargar"] = (pedidos) => {
    cancelarPrecarga();
    const pendientes = pedidos.filter((pedido) => !cache.has(pedido.clave));
    if (!pendientes.length) return;
    const control = new AbortController();
    precarga = control;
    const siguiente = (i: number) => {
      if (i >= pendientes.length || control.signal.aborted || !vivo) return;
      const pedido = pendientes[i];
      opts.pedir(pedido.request, control.signal).then(
        (vista) => {
          if (control.signal.aborted || !vivo) return;
          recordar(pedido.clave, vista);
          siguiente(i + 1);
        },
        // Una precarga que falla no avisa: la cara se pedirá de verdad al abrirla.
        () => { if (!control.signal.aborted) siguiente(i + 1); },
      );
    };
    siguiente(0);
  };

  return {
    solicitar,
    precargar,
    enCache: (clave) => cache.get(clave),
    estado: () => estado,
    destruir: () => {
      vivo = false;
      if (temporizador !== null) clearTimeout(temporizador);
      enVuelo?.abort();
      cancelarPrecarga();
    },
  };
}
