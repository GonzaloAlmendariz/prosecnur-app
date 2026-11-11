// Los pedidos de la vista previa de una pestaña de tablas (Frecuencias y
// Cruces): la hoja con las primeras tablas del archivo y, cuando la pregunta
// en foco no está entre ellas, esa sola tabla.
//
// Se vuelve a pedir cuando cambia algo que cambia el archivo: la base activa,
// la fuente o el universo de análisis (`useBaseDelCalculo`) y la config
// guardada (`useConfigGuardada`). Mientras un cambio espera al autosave no se
// pide: lo que se ve queda atenuado como pendiente.

import { useCallback, useMemo, useRef, useState } from "react";

import { useBaseDelCalculo } from "../ponderacion/useBaseDelCalculo";
import { useConfigGuardada } from "./useConfigGuardada";
import { useLecturaPorBase, type Lectura } from "./useLecturaPorBase";
import { siguienteLimite } from "./vistaPreviaModelo";

/** Lo que una vista previa de tablas tiene en común. */
export type HojaDelServicio<T> = { tablas: readonly T[]; recortado: boolean; total_variables: number };

/** El pedido de la hoja (`{ limite }`) o de una sola pregunta (`{ variables: [foco], limite: 1 }`). */
export type PedidoDeTablas = { variables?: string[]; limite: number };

type EnVuelo<P> = Map<string, Promise<P>>;

// Pedidos en vuelo por clave, de esta instancia. Dos lecturas con la misma
// clave comparten la respuesta: la app corre en StrictMode, que en desarrollo
// monta cada efecto dos veces (conservando las referencias), y sin esto cada
// pedido salía duplicado. El mapa es por instancia para que otro montaje, con
// otra config, nunca reciba una respuesta ajena. La entrada se borra al
// terminar: un Reintentar después de un fallo vuelve a pedir.
function compartido<P>(enVuelo: EnVuelo<P>, clave: string, pedir: () => Promise<P>): Promise<P> {
  const vigente = enVuelo.get(clave);
  if (vigente) return vigente;
  const promesa = pedir().finally(() => { enVuelo.delete(clave); });
  enVuelo.set(clave, promesa);
  return promesa;
}

export type VistaPreviaDeTablas<P> = {
  hoja: Lectura<P>;
  /** La tabla de la pregunta elegida cuando no está en la hoja; `null` si no hace falta pedirla. */
  elegida: Lectura<P> | null;
  /** Un cambio de los ajustes todavía no se guarda: lo que se ve es de antes. */
  pendiente: boolean;
  /** Hay ajustes hechos que todavía no se guardan: generar ahora usaría los anteriores. */
  sinGuardar: boolean;
  /** El guardado de los ajustes falló: su causa, o `null`. */
  errorGuardado: string | null;
  limite: number;
  /** Pide más tablas; ausente si ya están todas o se llegó al tope del servicio. */
  mostrarMas?: () => void;
  /** Lo que se ve es de una lectura anterior a la vigente. */
  releyendo: boolean;
  /**
   * La pregunta en foco tenía tabla y la perdió por un cambio de ajustes: el
   * foco se suelta y no se avisa (nadie la pidió). Si llegó por un enlace sin
   * haber tenido tabla, no cuenta como perdida: ahí sí va el aviso.
   */
  focoPerdido: boolean;
};

export function useVistaPreviaDeTablas<T, P extends HojaDelServicio<T>>({ foco, pedir, esLa, porPedido, tope }: {
  foco: string | null;
  /** La llamada al servicio. Debe ser estable (una función de módulo). */
  pedir: (pedido: PedidoDeTablas) => Promise<P>;
  /** La tabla es la de la variable en foco. */
  esLa: (tabla: T, variable: string) => boolean;
  /** Cuántas tablas se piden de entrada y cuántas más cada vez. */
  porPedido: number;
  /** El tope del servicio. */
  tope: number;
}): VistaPreviaDeTablas<P> {
  const base = useBaseDelCalculo();
  const guardada = useConfigGuardada();
  const [limite, setLimite] = useState(porPedido);
  const enVuelo = useRef<EnVuelo<P>>(new Map());

  const claveDeHoja = guardada.version === null ? null : JSON.stringify([base, guardada.version, limite]);
  const pedirHoja = useCallback(
    () => compartido(enVuelo.current, `hoja/${claveDeHoja}`, () => pedir({ limite })),
    [claveDeHoja, limite, pedir],
  );
  const hoja = useLecturaPorBase(pedirHoja, claveDeHoja);

  // La pregunta elegida se pide aparte solo si la hoja vigente no la trae.
  const hojaVigente = hoja.fase === "lista" ? hoja.datos : null;
  const enLaHoja = Boolean(foco && hojaVigente?.tablas.some((t) => esLa(t, foco)));
  // La última pregunta en foco que se vio con tabla (en la hoja o pedida aparte).
  const [conTabla, setConTabla] = useState<string | null>(null);
  if (foco && enLaHoja && conTabla !== foco) setConTabla(foco);
  const yaTuvoTabla = foco !== null && conTabla === foco;
  // Con la hoja completa, si no está es que la perdió: no hace falta pedirla.
  const perdidaEnLaHoja = Boolean(yaTuvoTabla && hojaVigente && !enLaHoja && !hojaVigente.recortado);
  const faltaLaElegida = Boolean(foco && hojaVigente && !enLaHoja && !perdidaEnLaHoja);
  const claveDeElegida = faltaLaElegida && claveDeHoja ? JSON.stringify([claveDeHoja, foco]) : null;
  const pedirElegida = useCallback(
    () => compartido(enVuelo.current, `elegida/${claveDeElegida}`, () => pedir({ variables: foco ? [foco] : [], limite: 1 })),
    [claveDeElegida, foco, pedir],
  );
  const elegida = useLecturaPorBase(pedirElegida, claveDeElegida);
  const aparteVigente = claveDeElegida && elegida.fase === "lista" ? elegida.datos : null;
  const aparteConTabla = Boolean(foco && aparteVigente?.tablas.some((t) => esLa(t, foco)));
  if (foco && aparteConTabla && conTabla !== foco) setConTabla(foco);
  const perdidaAparte = Boolean(yaTuvoTabla && aparteVigente && !aparteConTabla);

  const total = hoja.datos?.total_variables ?? 0;
  const siguiente = hoja.datos?.recortado ? siguienteLimite(limite, total, porPedido, tope) : null;
  const mostrarMas = useMemo(
    () => (siguiente === null ? undefined : () => setLimite(siguiente)),
    [siguiente],
  );

  return {
    hoja,
    elegida: claveDeElegida ? elegida : null,
    pendiente: guardada.pendiente,
    sinGuardar: guardada.sinGuardar,
    errorGuardado: guardada.errorGuardado,
    limite,
    mostrarMas,
    // Con el guardado fallido no se atenúa: la vista dice que muestra los ajustes anteriores.
    releyendo: hoja.datos !== null && (hoja.fase === "leyendo" || (guardada.pendiente && !guardada.errorGuardado)),
    focoPerdido: perdidaEnLaHoja || perdidaAparte,
  };
}
