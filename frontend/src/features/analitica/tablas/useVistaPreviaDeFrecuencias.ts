// Los pedidos de la vista previa de Frecuencias.
//
// Se vuelve a pedir cuando cambia algo que cambia el archivo: la base activa,
// la fuente o el universo de análisis (`useBaseDelCalculo`) y la config
// guardada (`useConfigGuardada`: orden, todas las opciones, nombres de sección,
// numéricas, notas, ponderación). Mientras un cambio espera al autosave no se
// pide: lo que se ve queda atenuado como pendiente.
//
// Dos lecturas: la hoja (las primeras `limite` tablas del archivo) y, cuando la
// pregunta elegida no está entre ellas, esa sola tabla.

import { useCallback, useMemo, useRef, useState } from "react";

import { apiAnaliticaFrecuenciasPreview, type FrecuenciasPreview } from "../../../api/analitica";
import { useBaseDelCalculo } from "../ponderacion/useBaseDelCalculo";
import { useConfigGuardada } from "./useConfigGuardada";
import { useLecturaPorBase, type Lectura } from "./useLecturaPorBase";
import { esLaVariable, siguienteLimite, TABLAS_POR_PEDIDO } from "./vistaPreviaModelo";

type EnVuelo = Map<string, Promise<FrecuenciasPreview>>;

// Pedidos en vuelo por clave, de esta instancia. Dos lecturas con la misma
// clave comparten la respuesta: la app corre en StrictMode, que en desarrollo
// monta cada efecto dos veces (conservando las referencias), y sin esto cada
// pedido salía duplicado. El mapa es por instancia para que otro montaje, con
// otra config, nunca reciba una respuesta ajena. La entrada se borra al
// terminar: un Reintentar después de un fallo vuelve a pedir.
function compartido(enVuelo: EnVuelo, clave: string, pedir: () => Promise<FrecuenciasPreview>): Promise<FrecuenciasPreview> {
  const vigente = enVuelo.get(clave);
  if (vigente) return vigente;
  const promesa = pedir().finally(() => { enVuelo.delete(clave); });
  enVuelo.set(clave, promesa);
  return promesa;
}

export type VistaPreviaDeFrecuencias = {
  hoja: Lectura<FrecuenciasPreview>;
  /** La tabla de la pregunta elegida cuando no está en la hoja; `null` si no hace falta pedirla. */
  elegida: Lectura<FrecuenciasPreview> | null;
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

export function useVistaPreviaDeFrecuencias(foco: string | null): VistaPreviaDeFrecuencias {
  const base = useBaseDelCalculo();
  const guardada = useConfigGuardada();
  const [limite, setLimite] = useState(TABLAS_POR_PEDIDO);
  const enVuelo = useRef<EnVuelo>(new Map());

  const claveDeHoja = guardada.version === null ? null : JSON.stringify([base, guardada.version, limite]);
  const pedirHoja = useCallback(
    () => compartido(enVuelo.current, `hoja/${claveDeHoja}`, () => apiAnaliticaFrecuenciasPreview({ limite })),
    [claveDeHoja, limite],
  );
  const hoja = useLecturaPorBase(pedirHoja, claveDeHoja);

  // La pregunta elegida se pide aparte solo si la hoja vigente no la trae.
  const hojaVigente = hoja.fase === "lista" ? hoja.datos : null;
  const enLaHoja = Boolean(foco && hojaVigente?.tablas.some((t) => esLaVariable(t, foco)));
  // La última pregunta en foco que se vio con tabla (en la hoja o pedida aparte).
  const [conTabla, setConTabla] = useState<string | null>(null);
  if (foco && enLaHoja && conTabla !== foco) setConTabla(foco);
  const yaTuvoTabla = foco !== null && conTabla === foco;
  // Con la hoja completa, si no está es que la perdió: no hace falta pedirla.
  const perdidaEnLaHoja = Boolean(yaTuvoTabla && hojaVigente && !enLaHoja && !hojaVigente.recortado);
  const faltaLaElegida = Boolean(foco && hojaVigente && !enLaHoja && !perdidaEnLaHoja);
  const claveDeElegida = faltaLaElegida && claveDeHoja ? JSON.stringify([claveDeHoja, foco]) : null;
  const pedirElegida = useCallback(
    () => compartido(enVuelo.current, `elegida/${claveDeElegida}`, () => apiAnaliticaFrecuenciasPreview({ variables: foco ? [foco] : [], limite: 1 })),
    [claveDeElegida, foco],
  );
  const elegida = useLecturaPorBase(pedirElegida, claveDeElegida);
  const aparteVigente = claveDeElegida && elegida.fase === "lista" ? elegida.datos : null;
  const aparteConTabla = Boolean(foco && aparteVigente?.tablas.some((t) => esLaVariable(t, foco)));
  if (foco && aparteConTabla && conTabla !== foco) setConTabla(foco);
  const perdidaAparte = Boolean(yaTuvoTabla && aparteVigente && !aparteConTabla);

  const total = hoja.datos?.total_variables ?? 0;
  const siguiente = hoja.datos?.recortado ? siguienteLimite(limite, total) : null;
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
