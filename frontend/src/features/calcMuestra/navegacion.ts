import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { conNivel } from "../../lib/navegacion/direccion";
import { useSeccion } from "../../lib/navegacion/useDireccion";

/**
 * Navegación direccionable de Cálculo de muestra.
 *
 * El módulo tenía 41 pantallas detrás de una sola dirección: `?modo=` se leía al
 * montar y se borraba, y sección y pestaña vivían en `useState`. Nada era
 * enlazable, contra el ADR 0044. Este módulo publica los tres niveles apoyado en
 * el hook compartido (`useSeccion`), que resuelve el default por modo desde el
 * manifiesto y descarta los niveles hijos al cambiar de padre.
 *
 * Dos decisiones que no son obvias:
 *
 * 1. **El modo se publica, pero `sin_definir` no.** `sin_definir` es el selector
 *    de tipo de estudio, o sea el aterrizaje del módulo; escribirlo ensuciaría
 *    la dirección desnuda sin hacer enlazable nada nuevo. Es el mismo criterio
 *    por el que la pestaña por defecto de una sección tampoco lleva param.
 *
 * 2. **Publicar el modo NO puede descartar la sección.** `useSeccion.irA`
 *    descarta los niveles hijos a propósito —cambiar de sección debe soltar la
 *    pestaña—, pero acá el modo no lo elige el usuario: lo deduce el estudio, y
 *    llega tarde respecto de un deep-link. Escribirlo con `irA` borraría la
 *    sección de `?modo=X&seccion=Y` justo al aterrizar. Por eso la publicación
 *    usa `conNivel`, que reescribe un nivel y preserva el resto.
 */

/** Los alias históricos del deep-link. Se leen; nunca se escriben. */
const ALIAS_MODO = ["mesa", "desk", "tipo"] as const;

/**
 * La mesa del dominio y el modo de la dirección se escriben distinto y hay que
 * traducir en la frontera.
 *
 * `ActiveDesk` usa snake_case porque es vocabulario del estudio; la gramática
 * normaliza todo token a kebab (`normalizarToken` en `direccion.ts` convierte
 * `_` y espacios en `-`). Publicar `opinion_universitaria` y leer de vuelta
 * `opinion-universitaria` haría que la comparación «¿ya está escrito?» fuera
 * siempre falsa, y el efecto de publicación se repetiría sin fin.
 */
const MODO_POR_DESK: Record<string, string> = {
  opinion_universitaria: "opinion-universitaria",
  marco_disponible: "marco-disponible",
  acreditacion: "acreditacion",
  territorial_handoff: "territorial-handoff",
  sin_definir: "sin-definir",
  legacy: "legacy",
};

const DESK_POR_MODO: Record<string, string> = Object.fromEntries(
  Object.entries(MODO_POR_DESK).map(([desk, modo]) => [modo, desk]),
);

/** El id de modo que le corresponde a una mesa en la dirección. */
export function modoDeDesk(desk: string): string {
  return MODO_POR_DESK[desk] ?? desk;
}

/** La mesa del dominio que nombra un modo de la dirección. */
export function deskDeModo(modo: string | null | undefined): string | null {
  if (!modo) return null;
  const normalizado = modo.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return DESK_POR_MODO[normalizado] ?? null;
}

/**
 * El modo pedido por la dirección, mirando también los alias históricos.
 * Devuelve el crudo: traducirlo a una mesa concreta es del dominio del módulo.
 */
export function modoCrudoDeLaDireccion(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const canonico = params.get("modo");
  if (canonico) return canonico;
  for (const alias of ALIAS_MODO) {
    const valor = params.get(alias);
    if (valor) return valor;
  }
  return null;
}

/** Deja la dirección sin los alias históricos, ya traducidos al param canónico. */
export function sinAliasDeModo(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  let tocado = false;
  for (const alias of ALIAS_MODO) {
    if (params.has(alias)) {
      params.delete(alias);
      tocado = true;
    }
  }
  if (!tocado) return search;
  const query = params.toString();
  return query ? `?${query}` : "";
}

export type ControlCalcMuestra = ReturnType<typeof useSeccion> & {
  /** La sección vigente, ya validada contra las secciones del modo real. */
  seccionVigente: string;
  /** Escribe la sección en la dirección. Descarta pestaña, como manda la gramática. */
  irASeccion: (id: string) => void;
  /** Escribe la pestaña en la dirección. */
  irAPestana: (id: string | null) => void;
  /**
   * Salta a una sección y a una pestaña suya de una vez.
   *
   * Encadenar `irASeccion` + `irAPestana` no sirve: ambas leen el `location` del
   * render en curso, así que la segunda navegación pisa a la primera y la
   * sección se pierde. El Recorrido navega justo así —capítulo y sección a la
   * vez—, de modo que la composición tiene que ocurrir sobre un solo `search`.
   */
  irASeccionYPestana: (seccion: string, pestana?: string | null) => void;
};

/**
 * @param deskReal   La mesa que el estudio determinó. Manda sobre la dirección.
 * @param listoParaPublicar  `false` mientras el estudio se hidrata: publicar
 *   antes escribiría un modo que todavía puede cambiar.
 * @param seccionPorDefecto  A dónde caer cuando la dirección no nombra una
 *   sección válida para la mesa real.
 */
export function useCalcMuestraDireccion(
  deskReal: string,
  listoParaPublicar: boolean,
  seccionPorDefecto: string,
): ControlCalcMuestra {
  const nav = useSeccion("calc-muestra");
  const location = useLocation();
  const navigate = useNavigate();

  // El modo real se publica en la dirección; el selector queda desnudo.
  useEffect(() => {
    if (!listoParaPublicar) return;
    const conAlias = modoCrudoDeLaDireccion(location.search);
    const debePublicar = deskReal !== "sin_definir";
    const modoEsperado = modoDeDesk(deskReal);
    const yaEscrito = nav.modo === modoEsperado && !conAlias;

    if (debePublicar && yaEscrito) return;
    if (!debePublicar && !nav.modo && !conAlias) return;

    const base = sinAliasDeModo(location.search);
    const siguiente = conNivel(base, "modo", debePublicar ? modoEsperado : null);
    if (siguiente === location.search) return;
    navigate({ pathname: location.pathname, search: siguiente }, { replace: true });
  }, [deskReal, listoParaPublicar, location.pathname, location.search, nav.modo, navigate]);

  // `useSeccion` resuelve contra el modo que la dirección trae, que durante el
  // primer render puede no ser todavía el real. Revalidar acá evita que el rail
  // parpadee con la sección de otra mesa.
  const seccionVigente = useMemo(() => {
    const deLaDireccion = nav.seccion;
    if (deLaDireccion && nav.secciones.some((s) => s.id === deLaDireccion)) return deLaDireccion;
    return seccionPorDefecto;
  }, [nav.seccion, nav.secciones, seccionPorDefecto]);

  const irASeccion = useCallback(
    (id: string) => {
      nav.irA("seccion", id);
    },
    [nav],
  );

  const irAPestana = useCallback(
    (id: string | null) => {
      nav.irA("pestana", id);
    },
    [nav],
  );

  const irASeccionYPestana = useCallback(
    (seccion: string, pestana?: string | null) => {
      // `hrefDe` ya descarta los hijos de sección —incluida la pestaña—, así que
      // la pestaña nueva se escribe encima del resultado, no del search actual.
      const conSeccion = nav.hrefDe("seccion", seccion);
      const [pathname, search = ""] = conSeccion.split("?");
      const destino = conNivel(search ? `?${search}` : "", "pestana", pestana ?? null);
      navigate(`${pathname}${destino}`);
    },
    [nav, navigate],
  );

  return { ...nav, seccionVigente, irASeccion, irAPestana, irASeccionYPestana };
}
