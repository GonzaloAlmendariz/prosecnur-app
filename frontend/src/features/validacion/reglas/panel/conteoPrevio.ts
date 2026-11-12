/**
 * El conteo previo de "Casos que marca hoy" (`POST /reglas_custom/probar`,
 * contrato M1, sección 1), sin React.
 *
 * Cada pedido tarda alrededor de un segundo porque el motor lee la base. Por
 * eso: (1) se espera a que el borrador se quede quieto `esperaMs` antes de
 * pedir; (2) un borrador nuevo cancela el pedido anterior con su
 * `AbortSignal`, y una respuesta que llega tarde se descarta; (3) el mismo
 * borrador no se vuelve a pedir.
 */
import type { PruebaDeRegla } from "../../../../api/validacionAuditoria";

export type EstadoDelConteo =
  | { fase: "sin-regla" }
  | { fase: "contando" }
  | { fase: "listo"; prueba: PruebaDeRegla }
  /** `codigo`: el `E_*` del motor, o "" si el pedido no llegó (sin conexión). */
  | { fase: "error"; mensaje: string; codigo: string };

export type Probar = (cuerpo: Record<string, unknown>, opciones: { signal: AbortSignal }) => Promise<PruebaDeRegla>;

/**
 * La espera antes de contar. Larga a propósito: el conteo cuesta un segundo
 * de motor y nadie lo necesita a media tecla.
 */
export const ESPERA_DEL_CONTEO_MS = 800;

let esperaVigente = ESPERA_DEL_CONTEO_MS;

/** La espera con que arranca un panel nuevo. */
export function esperaDelConteo(): number {
  return esperaVigente;
}

/**
 * Solo para pruebas: una caracterización que no mide el conteo lo aleja (así
 * su huella no depende de lo cargada que esté la máquina) y la que lo mide lo
 * acerca. Devuelve la anterior.
 */
export function fijarEsperaDelConteoParaPruebas(ms: number): number {
  const anterior = esperaVigente;
  esperaVigente = ms;
  return anterior;
}

function esCancelacion(e: unknown): boolean {
  return e instanceof DOMException ? e.name === "AbortError" : (e as { name?: string } | null)?.name === "AbortError";
}

export function crearConteoPrevio({
  probar,
  alCambiar,
  esperaMs = ESPERA_DEL_CONTEO_MS,
}: {
  probar: Probar;
  alCambiar: (estado: EstadoDelConteo) => void;
  esperaMs?: number;
}) {
  let clave: string | null = null;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let control: AbortController | null = null;
  let cerrado = false;
  let ultimo: Record<string, unknown> | null = null;

  function cortar() {
    if (temporizador !== null) clearTimeout(temporizador);
    temporizador = null;
    control?.abort();
    control = null;
  }

  /** Pide contar este borrador (`null`: la regla no está completa). */
  function pedir(cuerpo: Record<string, unknown> | null) {
    if (cerrado) return;
    ultimo = cuerpo;
    const siguiente = cuerpo ? JSON.stringify(cuerpo) : null;
    if (siguiente === clave) return;
    clave = siguiente;
    cortar();
    if (!cuerpo) {
      alCambiar({ fase: "sin-regla" });
      return;
    }
    alCambiar({ fase: "contando" });
    temporizador = setTimeout(() => {
      temporizador = null;
      const propio = new AbortController();
      control = propio;
      probar(cuerpo, { signal: propio.signal }).then(
        (prueba) => {
          if (propio.signal.aborted || cerrado) return;
          control = null;
          alCambiar({ fase: "listo", prueba });
        },
        (e: unknown) => {
          if (propio.signal.aborted || cerrado || esCancelacion(e)) return;
          control = null;
          const codigo = typeof (e as { code?: unknown } | null)?.code === "string" ? String((e as { code: string }).code) : "";
          alCambiar({ fase: "error", mensaje: e instanceof Error ? e.message : String(e), codigo });
        },
      );
    }, esperaMs);
  }

  return {
    pedir,
    /** Vuelve a pedir el último borrador (tras un error). */
    reintentar() {
      clave = null;
      pedir(ultimo);
    },
    /** Al cerrar el panel: nada queda en vuelo. */
    cerrar() {
      cerrado = true;
      cortar();
    },
  };
}
