// =============================================================================
// La pestaña de Validación vive en la URL
// =============================================================================
// Las pestañas de Validación eran las únicas de Procesamiento sin dirección
// publicada: el tab activo vivía en un `activeTab` del store zustand. Eso
// rompe el contrato v3 (toda vista es enlazable) y además dejaba a
// `__pulsoNav.ir()` sin poder entrar (`runtime.ts` se niega a navegar a un
// nodo no publicado), que es la puerta por la que el QA visual recorre la app.
//
// Se usa `useSeccion`, el lector canónico, y no un séptimo `useSearchParams`.
// Las claves viejas (`instrumento`, `reglas_custom`, `limpieza`) las resuelve
// `pestanaValidacion.ts`, que también normaliza el token como la dirección
// (minúsculas, `_` a `-`).
//
// Lo elegido dentro de la pestaña también vive en la dirección (plan de
// fidelidad, rebanada V0):
//   - Reglas: `familia=<clave>` (la familia de la columna izquierda) y
//     `foco=<id de regla>` (la ficha de la derecha).
//   - Hallazgos: `foco=<id de regla>` (el hallazgo de la cola). Con el caso
//     abierto (`panel=caso`) el foco es el id del caso.
//   - Explorar: `foco=<código de la pregunta>` (la pregunta que se explora,
//     rebanada V5). "Ver en Explorar" llega con `searchDeExplorar`.
// `familia` es un parámetro propio de Reglas, fuera de los cinco niveles de la
// gramática, que la dirección conserva (`extra`). Cambiar de pestaña descarta
// los dos.
// =============================================================================

import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { conNivel } from "../../lib/navegacion/direccion";
import { searchConNivel, useDireccion, useSeccion } from "../../lib/navegacion/useDireccion";
import { esAliasDelDetalleDeRegla, resolverPestanaValidacion } from "./pestanaValidacion";
import { PANEL_CASO_VALIDACION, PANEL_REGLA_VALIDACION } from "./panelesValidacion";
import { PARAM_PREGUNTA, PARAM_TIPO } from "./reglas/panel/usePanelRegla";
import { useValidacionStore } from "./store";
import type { ValidacionTabId } from "./types";

/** Parámetro de Reglas con la familia elegida. */
export const PARAM_FAMILIA = "familia";

/**
 * La pestaña que nombra la URL, con las claves viejas resueltas, o la primera
 * si no nombra ninguna válida.
 */
export function resolverPestana(pedida: string | null | undefined): ValidacionTabId {
  return resolverPestanaValidacion(pedida);
}

export type SeleccionDeValidacion = {
  /** Solo en Reglas. */
  familia: string | null;
  /** La regla de la ficha en Reglas; el hallazgo de la cola en Hallazgos; la pregunta en Explorar. */
  foco: string | null;
};

/**
 * Lo elegido en la pestaña activa, según la dirección. `pedida` y `panel` son
 * los crudos de la dirección: el enlace viejo al detalle de una regla
 * (`instrumento&panel=regla&foco=<id>`) da la regla en Reglas.
 */
export function seleccionDeLaDireccion(direccion: {
  pedida: string | null | undefined;
  panel: string | null | undefined;
  foco: string | null | undefined;
  familia: string | null | undefined;
}): SeleccionDeValidacion {
  const pestana = resolverPestana(direccion.pedida);
  const foco = direccion.foco && direccion.foco.trim() ? direccion.foco : null;
  const familia = direccion.familia && direccion.familia.trim() ? direccion.familia : null;
  if (pestana === "reglas") {
    // El editor (`panel=regla`) usa el foco para la regla que edita; el enlace viejo, no.
    const delEditor = !!direccion.panel && direccion.panel === PANEL_REGLA_VALIDACION.id
      && !esAliasDelDetalleDeRegla(direccion.pedida, direccion.panel);
    return { familia, foco: delEditor ? null : foco };
  }
  if (pestana === "hallazgos") {
    // Con el caso abierto (`panel=caso`) el foco es del caso. El enlace viejo al
    // detalle de una regla (`panel=regla&foco=<id>`) abre el hallazgo de esa
    // regla (rebanada V3).
    const delCaso = !!direccion.panel && direccion.panel === PANEL_CASO_VALIDACION.id;
    return { familia: null, foco: delCaso ? null : foco };
  }
  if (pestana === "explorar") return { familia: null, foco };
  return { familia: null, foco: null };
}

function conParametro(search: string, clave: string, valor: string | null): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (valor) params.set(clave, valor);
  else params.delete(clave);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * El `search` al pasar a otra pestaña: la pestaña nueva, sin panel, y sin lo
 * elegido en la anterior (`foco` y `familia` nombran entidades de esa pestaña).
 * `seleccion` lleva lo que se elige en la nueva.
 */
export function searchDePestana(
  search: string,
  tab: ValidacionTabId,
  seleccion: Partial<SeleccionDeValidacion> = {},
): string {
  let siguiente = searchConNivel(search, "pestana", tab);
  siguiente = conNivel(siguiente, "foco", seleccion.foco ?? null);
  siguiente = conParametro(siguiente, PARAM_FAMILIA, tab === "reglas" ? seleccion.familia ?? null : null);
  return siguiente;
}

/**
 * El `search` de Explorar con una pregunta: la pestaña, sin panel, sin la
 * familia de Reglas ni lo que solo usa el panel de regla (`tipo`, `pregunta`),
 * y la pregunta en el foco. Es la dirección de "Ver en Explorar".
 */
export function searchDeExplorar(search: string, variable: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("panel");
  params.delete(PARAM_TIPO);
  params.delete(PARAM_PREGUNTA);
  const limpio = params.toString();
  return searchDePestana(limpio ? `?${limpio}` : "", "explorar", { foco: variable });
}

/** El `search` con lo elegido dentro de la pestaña: solo cambia lo que se pasa. */
export function searchConSeleccion(search: string, seleccion: Partial<SeleccionDeValidacion>): string {
  let siguiente = search;
  if (seleccion.foco !== undefined) siguiente = conNivel(siguiente, "foco", seleccion.foco);
  if (seleccion.familia !== undefined) siguiente = conParametro(siguiente, PARAM_FAMILIA, seleccion.familia);
  return siguiente;
}

export type PestanaDireccionable = {
  pestana: ValidacionTabId;
  /**
   * Cambia de pestaña. `prefill` es el payload que la pestaña destino lee al
   * montarse (el viejo `jumpTo` del store, que ahora sólo aporta el prefill:
   * quién manda es la dirección). `seleccion` es lo que se abre elegido en la
   * pestaña destino (la regla en Reglas, el hallazgo en Hallazgos).
   */
  irAPestana: (tab: ValidacionTabId, prefill?: Record<string, unknown>, seleccion?: Partial<SeleccionDeValidacion>) => void;
};

export function usePestanaValidacion(): PestanaDireccionable {
  const { pestana } = useSeccion("procesamiento");
  const location = useLocation();
  const navigate = useNavigate();
  const setPrefill = useValidacionStore((s) => s.setPrefill);

  const activa = useMemo(() => resolverPestana(pestana), [pestana]);

  const irAPestana = useCallback(
    (tab: ValidacionTabId, prefill?: Record<string, unknown>, seleccion?: Partial<SeleccionDeValidacion>) => {
      if (prefill) setPrefill(tab, prefill);
      navigate({ pathname: location.pathname, search: searchDePestana(location.search, tab, seleccion) });
    },
    [location.pathname, location.search, navigate, setPrefill],
  );

  return { pestana: activa, irAPestana };
}

/**
 * Lo elegido en la pestaña activa y cómo cambiarlo. Elegir no es navegar: se
 * escribe con `replace`.
 */
export function useSeleccionDeValidacion(): SeleccionDeValidacion & {
  elegir: (seleccion: Partial<SeleccionDeValidacion>) => void;
} {
  const direccion = useDireccion();
  const location = useLocation();
  const navigate = useNavigate();
  // `pestana` y `panel` vuelven normalizados; para reconocer el enlace viejo basta con eso.
  const seleccion = useMemo(
    () => seleccionDeLaDireccion({
      pedida: direccion?.pestana,
      panel: direccion?.panel,
      foco: direccion?.foco,
      familia: direccion?.extra?.[PARAM_FAMILIA],
    }),
    [direccion?.pestana, direccion?.panel, direccion?.foco, direccion?.extra],
  );
  const elegir = useCallback(
    (cambio: Partial<SeleccionDeValidacion>) => {
      navigate({ pathname: location.pathname, search: searchConSeleccion(location.search, cambio) }, { replace: true });
    },
    [location.pathname, location.search, navigate],
  );
  return { ...seleccion, elegir };
}
