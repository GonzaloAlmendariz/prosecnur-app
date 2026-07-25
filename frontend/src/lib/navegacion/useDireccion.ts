/**
 * Lectura y escritura de la dirección canónica, como hook.
 *
 * `direccion.ts` ya resuelve la gramática completa —parseo, alias legacy por
 * módulo, serialización— pero no la expone en forma consumible por un
 * componente, y el resultado fue que cada módulo escribió su propio lector
 * importando solo la constante `PARAMS_DIRECCION`: Monitoreo, Bitácora,
 * Codificación, Analítica, Hojas de ruta y Cálculo de muestra tienen hoy seis
 * implementaciones del mismo `useSearchParams` con la misma intención y
 * distintos detalles.
 *
 * Este archivo no reimplementa nada: `useDireccion` es `parsearDireccion` sobre
 * el `location` de React Router, y `useSeccion` le suma las dos cosas que un
 * chrome de módulo necesita y que hoy cada uno resuelve a mano — el default del
 * manifiesto cuando la URL no dice sección, y el descarte de los niveles hijos
 * al cambiar de nivel padre.
 *
 * Los seis lectores existentes NO se migran acá: eso es un refactor de
 * navegación con su propio riesgo. Lo que sí hace este archivo es cerrar la
 * puerta para que no aparezca un séptimo.
 */

import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  PROSECNUR_MODULES,
  type ProsecnurModuleMeta,
  type ProsecnurModuleSectionMeta,
  type ProsecnurModuleSlug,
  type ProsecnurNavigationLeafMeta,
} from "../modules";
import {
  PARAMS_DIRECCION,
  conNivel,
  parsearDireccion,
  type DireccionProsecnur,
} from "./direccion";

/**
 * La dirección de la ubicación actual, o `null` si el pathname no pertenece a
 * ningún módulo (`/`, rutas públicas). `null` no es un error: hay pantallas
 * fuera de la jerarquía y la gramática no pretende cubrirlas.
 */
export function useDireccion(): DireccionProsecnur | null {
  const { pathname, search } = useLocation();
  return useMemo(() => parsearDireccion(pathname, search), [pathname, search]);
}

/**
 * Al cambiar un nivel, los niveles hijos dejan de existir: la pestaña «UMP» de
 * la sección Avance no significa nada en la sección Fuentes, y arrastrarla
 * produce una pestaña activa que el rail nuevo no lista. Esta tabla dice qué se
 * descarta al escribir cada nivel.
 */
const NIVELES_HIJOS: Record<NivelEscribible, readonly NivelEscribible[]> = {
  modo: ["seccion", "pestana", "panel"],
  seccion: ["pestana", "panel"],
  pestana: ["panel"],
  panel: [],
};

export type NivelEscribible = "modo" | "seccion" | "pestana" | "panel";

// ---------------------------------------------------------------------------
// Núcleo puro
// ---------------------------------------------------------------------------
// Las tres decisiones que un chrome de módulo tiene que tomar viven acá como
// funciones sin React, porque son las que pueden equivocarse y las que hay que
// poder probar. El hook de abajo solo las conecta a `location`.

/**
 * Las secciones que corresponden al modo activo. Un modo REESCRIBE el juego de
 * secciones (no lo filtra), así que los juegos no se mezclan nunca.
 */
export function seccionesDelModo(
  meta: Pick<ProsecnurModuleMeta, "sections" | "modos"> | null,
  modo: string | null | undefined,
): readonly ProsecnurModuleSectionMeta[] {
  if (!meta) return [];
  if (meta.modos && meta.modos.length > 0) {
    const activo = meta.modos.find((m) => m.id === modo) ?? meta.modos[0];
    return activo.sections;
  }
  return meta.sections;
}

/**
 * La sección efectiva. La URL puede nombrar una que el modo activo no tiene
 * —enlace viejo, o modo que cambió al abrir otro estudio— y en ese caso se cae
 * al default del manifiesto: es preferible a dejar el rail sin nada
 * seleccionado, que es lo que hacía más de un módulo.
 */
export function resolverSeccion(
  pedida: string | null | undefined,
  secciones: readonly ProsecnurModuleSectionMeta[],
): string | null {
  if (pedida && secciones.some((s) => s.id === pedida)) return pedida;
  return secciones[0]?.id ?? pedida ?? null;
}

/**
 * El `search` con un nivel reescrito y sus niveles hijos descartados.
 *
 * El descarte es la parte que se olvida: la pestaña «UMP» de la sección Avance
 * no significa nada en la sección Fuentes, y arrastrarla deja una pestaña
 * activa que el rail nuevo no lista. Cambiar de modo descarta sección, pestaña
 * y panel; cambiar de sección descarta pestaña y panel.
 */
export function searchConNivel(
  search: string,
  nivel: NivelEscribible,
  id: string | null,
): string {
  let siguiente = conNivel(search, nivel, id);
  for (const hijo of NIVELES_HIJOS[nivel]) {
    siguiente = conNivel(siguiente, hijo, null);
  }
  return siguiente;
}

export type ControlSeccion = {
  modo: string | null;
  /** Ya resuelta: si la URL no la nombra, es la primera del modo activo. */
  seccion: string | null;
  pestana: string | null;
  panel: string | null;
  foco: string | null;
  /** Las secciones que corresponden al modo activo, en orden de manifiesto. */
  secciones: readonly ProsecnurModuleSectionMeta[];
  /** Las pestañas de la sección activa, vacío si el manifiesto no las declara. */
  pestanas: readonly ProsecnurNavigationLeafMeta[];
  irA: (nivel: NivelEscribible, id: string | null, opciones?: { replace?: boolean }) => void;
  hrefDe: (nivel: NivelEscribible, id: string | null) => string;
};

export function useSeccion(modulo: ProsecnurModuleSlug): ControlSeccion {
  const location = useLocation();
  const navigate = useNavigate();
  const direccion = useDireccion();

  const meta = useMemo(
    () => PROSECNUR_MODULES.find((m) => m.slug === modulo) ?? null,
    [modulo],
  );

  const secciones = useMemo(
    () => seccionesDelModo(meta, direccion?.modo),
    [meta, direccion?.modo],
  );

  const seccion = useMemo(
    () => resolverSeccion(direccion?.seccion, secciones),
    [direccion?.seccion, secciones],
  );

  const pestanas = useMemo(
    () => secciones.find((s) => s.id === seccion)?.tabs ?? [],
    [secciones, seccion],
  );

  const hrefDe = useCallback(
    (nivel: NivelEscribible, id: string | null) =>
      `${location.pathname}${searchConNivel(location.search, nivel, id)}`,
    [location.pathname, location.search],
  );

  const irA = useCallback(
    (nivel: NivelEscribible, id: string | null, opciones?: { replace?: boolean }) => {
      navigate(hrefDe(nivel, id), { replace: opciones?.replace ?? false });
    },
    [hrefDe, navigate],
  );

  return {
    modo: direccion?.modo ?? null,
    seccion,
    pestana: direccion?.pestana ?? null,
    panel: direccion?.panel ?? null,
    foco: direccion?.foco ?? null,
    secciones,
    pestanas,
    irA,
    hrefDe,
  };
}

/** Los nombres canónicos, reexportados para no tentar a importar la constante. */
export { PARAMS_DIRECCION };
