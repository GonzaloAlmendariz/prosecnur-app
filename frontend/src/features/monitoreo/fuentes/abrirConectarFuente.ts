// Abrir el panel de conectar fuente, con o sin una fuente que cambiar.
//
// Fuentes tenía dos formas de tocar una conexión: el panel «Conectar fuente»
// —que pregunta por papel y servicio siguiendo el guion del estudio— y unos
// formularios sueltos dentro de las pestañas, con la dirección del Sheet, la
// pestaña, el rango y el servidor de Kobo a la vista. Los segundos hacían el
// mismo trabajo peor y en el sitio equivocado: Fuentes declara qué significan
// los números, no cómo está cableado el estudio.
//
// Al retirarlos hace falta una puerta desde la tarjeta de cada pieza hacia el
// panel, y esa puerta tiene que ser direccionable (ADR 0044) o el QA visual no
// la alcanza. El panel ya se abre con `?panel=`; lo que falta es decir CUÁL
// fuente se va a cambiar, y eso viaja en `?foco=`.
//
// `foco` ya se usaba para el actor sobre el que se pulsó, así que la fuente se
// distingue con un prefijo explícito —`fuente:<id>`— en vez de adivinar por el
// valor. Adivinar habría bastado hoy y habría fallado el día que un actor se
// llame igual que el id de una fuente.

import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PANELES_POR_MODULO } from "../../../lib/navegacion/manifiesto";

const PANEL = PANELES_POR_MODULO.monitoreo![0];

const PREFIJO_FUENTE = "fuente:";

/** Id de la fuente que `?foco=` pide cambiar, si es que pide una. */
export function fuenteEnFoco(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const foco = params.get("foco") ?? "";
  return foco.startsWith(PREFIJO_FUENTE) ? foco.slice(PREFIJO_FUENTE.length).trim() : "";
}

/** El actor que `?foco=` trae, cuando no está pidiendo una fuente. */
export function actorEnFoco(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const foco = params.get("foco") ?? "";
  return foco.startsWith(PREFIJO_FUENTE) ? "" : foco.trim();
}

/**
 * Los dos modos de abrir el panel, en un solo `navigate`.
 *
 * En uno solo y no en dos —escribir `?foco=` y después pedir `abrir()`— porque
 * el segundo pisaría al primero: cada `navigate` parte de la URL que React
 * Router tiene renderizada, no de la que acaba de programarse.
 */
export function useAbrirConectarFuente() {
  const navigate = useNavigate();
  const location = useLocation();

  const abrir = useCallback((sourceId?: string) => {
    const params = new URLSearchParams(location.search);
    params.set("panel", PANEL.id);
    if (sourceId) params.set("foco", `${PREFIJO_FUENTE}${sourceId}`);
    else params.delete("foco");
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: false });
  }, [location.pathname, location.search, navigate]);

  return {
    /** Conectar algo nuevo: el guion decide por dónde empezar. */
    abrirNueva: useCallback(() => abrir(), [abrir]),
    /** Cambiar una conexión que ya existe, con sus datos delante. */
    abrirParaCambiar: abrir,
  };
}
