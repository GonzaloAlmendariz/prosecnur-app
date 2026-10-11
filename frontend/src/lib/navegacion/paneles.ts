// Paneles direccionables: el quinto nivel de la jerarquía.
//
// Un panel es cualquier superficie superpuesta —popover, sideover, drawer,
// diálogo, inspector— que antes solo se podía abrir con un click y por lo
// tanto no se podía enlazar ni auditar. Con este módulo un panel se abre con
// `?panel=<id>` y, al abrirse por click, escribe ese param él solo: el enlace
// que ves en la barra de direcciones siempre reproduce lo que estás viendo.
//
// Reglas:
// - El `id` es estable y ASCII (`novedades`, `filtros`, `estilo-global`). No
//   se deriva de la etiqueta visible, justamente para que renombrar el copy no
//   rompa un enlace ni una corrida de QA.
// - El panel se registra al montarse, así el inspector puede enumerar qué
//   paneles existen de verdad en la vista actual y detectar deriva contra el
//   catálogo declarado.
// - Cerrar un panel borra el param; no ensucia el historial (`replace`).

import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PARAMS_DIRECCION } from "./direccion";

/** Forma legacy de abrir un panel, previa a `?panel=`. */
export type AliasPanelLegacy = {
  param: string;
  /** Si se omite, cualquier valor presente abre el panel. */
  valor?: string;
};

export type PanelDeclarado = {
  id: string;
  label: string;
  /** Tipo de superficie; el QA visual lo usa para saber qué esperar. */
  clase: "dialogo" | "sideover" | "popover" | "inspector";
  alias?: readonly AliasPanelLegacy[];
};

// ---------------------------------------------------------------------------
// Registro en runtime
// ---------------------------------------------------------------------------

type PanelMontado = { id: string; abierto: boolean };

const PANELES_MONTADOS = new Map<string, PanelMontado>();

export function panelesMontados(): PanelMontado[] {
  return [...PANELES_MONTADOS.values()].map((panel) => ({ ...panel }));
}

function registrarPanel(id: string, abierto: boolean) {
  PANELES_MONTADOS.set(id, { id, abierto });
}

function olvidarPanel(id: string) {
  PANELES_MONTADOS.delete(id);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function coincideAlias(
  params: URLSearchParams,
  alias: readonly AliasPanelLegacy[] | undefined,
): boolean {
  return (alias ?? []).some(({ param, valor }) => {
    const actual = params.get(param);
    if (actual === null) return false;
    return valor === undefined ? actual.trim() !== "" : actual === valor;
  });
}

// ---------------------------------------------------------------------------
// Lógica pura de params
// ---------------------------------------------------------------------------
//
// Separada del hook a propósito: es la parte que decide si un panel está
// abierto y qué URL produce abrirlo o cerrarlo, y se puede probar sin montar
// React ni un router.

function comoParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

function comoSearch(params: URLSearchParams): string {
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** ¿La URL pide este panel? Acepta la forma canónica y los alias legacy. */
export function panelAbiertoEn(search: string, panel: PanelDeclarado): boolean {
  const params = comoParams(search);
  return (
    params.get(PARAMS_DIRECCION.panel) === panel.id ||
    coincideAlias(params, panel.alias)
  );
}

/**
 * URL que abre el panel. Escribe la forma canónica y borra los alias, para que
 * abrir desde un enlace viejo migre la dirección en vez de duplicarla.
 */
export function searchConPanel(search: string, panel: PanelDeclarado): string {
  const params = comoParams(search);
  params.set(PARAMS_DIRECCION.panel, panel.id);
  for (const { param } of panel.alias ?? []) params.delete(param);
  return comoSearch(params);
}

/** URL que cierra el panel, preservando todo lo demás. */
export function searchSinPanel(search: string, panel: PanelDeclarado): string {
  const params = comoParams(search);
  params.delete(PARAMS_DIRECCION.panel);
  for (const { param } of panel.alias ?? []) params.delete(param);
  return comoSearch(params);
}

export type ControlPanel = {
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
  alternar: () => void;
  /** Props a esparcir en la raíz del panel para que el QA lo identifique. */
  props: { "data-pulso-panel": string };
};

/**
 * Conecta un panel a la dirección canónica.
 *
 * `alias` mantiene vivos los enlaces antiguos (`?agregar=1`, `?settings=…`):
 * se leen, pero al abrir por click siempre se escribe la forma canónica.
 */
export function usePanelDireccionable(
  panel: PanelDeclarado,
): ControlPanel {
  const location = useLocation();
  const navigate = useNavigate();

  const abierto = panelAbiertoEn(location.search, panel);

  useEffect(() => {
    registrarPanel(panel.id, abierto);
    return () => olvidarPanel(panel.id);
  }, [panel.id, abierto]);

  // Siempre sobre el pathname ACTUAL: abrir un panel desde dentro de un módulo
  // y cerrarlo no puede devolverte al home.
  const escribir = useCallback(
    (search: string) => {
      navigate({ pathname: location.pathname, search }, { replace: true });
    },
    [location.pathname, navigate],
  );

  const abrir = useCallback(() => {
    escribir(searchConPanel(location.search, panel));
  }, [escribir, location.search, panel]);

  const cerrar = useCallback(() => {
    escribir(searchSinPanel(location.search, panel));
  }, [escribir, location.search, panel]);

  const alternar = useCallback(() => {
    if (abierto) cerrar();
    else abrir();
  }, [abierto, abrir, cerrar]);

  return {
    abierto,
    abrir,
    cerrar,
    alternar,
    props: { "data-pulso-panel": panel.id },
  };
}

// ---------------------------------------------------------------------------
// Paneles condicionados: la dirección reproduce lo que se ve
// ---------------------------------------------------------------------------
//
// Hay paneles que solo existen si el dato lo permite (la reconciliación de
// Carga sin variables extra, los diálogos de edición del Dashboard sin fuente
// o en vista previa). Un `?panel=` que pide uno de esos y no abre nada deja una
// URL que miente: dice «panel abierto» sobre una pantalla sin panel. La regla
// es borrar el param en cuanto se sabe que no aplica, y no antes: mientras el
// dato carga, el panel espera.

export type ResolucionPanel = "cerrado" | "esperar" | "abrir" | "borrar";

/** Qué hacer con un panel pedido cuyo contenido depende de un dato. */
export function resolverPanelCondicionado(
  abierto: boolean,
  estado: { resuelto: boolean; aplica: boolean },
): ResolucionPanel {
  if (!abierto) return "cerrado";
  if (!estado.resuelto) return "esperar";
  return estado.aplica ? "abrir" : "borrar";
}

/**
 * Borra de la dirección un panel pedido que no aplica. Devuelve si el panel
 * debe pintarse ahora (`abrir`).
 */
export function usePanelCondicionado(
  control: Pick<ControlPanel, "abierto" | "cerrar">,
  estado: { resuelto: boolean; aplica: boolean },
): boolean {
  const resolucion = resolverPanelCondicionado(control.abierto, estado);
  const { cerrar } = control;
  useEffect(() => {
    if (resolucion === "borrar") cerrar();
  }, [resolucion, cerrar]);
  return resolucion === "abrir";
}
