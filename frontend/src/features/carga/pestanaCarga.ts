// Qué pestaña de Carga abre una dirección (ADR 0142).
//
// Las claves de Carga cambiaron el 2026-11-11: Plan y Fuentes se funden en
// Bases, Estructura pasa a Formulario y Datos a Respuestas. Un enlace guardado
// con la clave vieja sigue abriendo su pestaña: la clave se LEE aquí y la
// dirección no se reescribe. Ningún código escribe una clave vieja
// (`direccionesRenombradasNoSeEscriben.contract.test.ts`).
//
// El panel lateral "Variables de la base" (`panel=variables-base&foco=<base>`)
// pasó a ser la pestaña Variables: se lee igual, con su base en `foco`.

import {
  PROCESAMIENTO_PESTANAS,
  type CargaWorkspaceTab,
} from "../../lib/navegacion/catalogos/procesamiento";

export const PESTANA_CARGA_POR_DEFECTO = "bases" satisfies CargaWorkspaceTab;

/** Clave vieja → pestaña que la reemplaza. Solo se lee. */
export const ALIAS_PESTANAS_CARGA = {
  plan: "bases",
  fuentes: "bases",
  estructura: "formulario",
  datos: "respuestas",
} as const satisfies Readonly<Record<string, CargaWorkspaceTab>>;

/** El panel que pasó a pestaña: `panel=variables-base&foco=<base>`. */
export const PANEL_ALIAS_VARIABLES = "variables-base";

const CLAVES_CARGA: readonly string[] = PROCESAMIENTO_PESTANAS.carga.map((tab) => tab.key);

function esClaveCarga(valor: string): valor is CargaWorkspaceTab {
  return CLAVES_CARGA.includes(valor);
}

/** La clave canónica que nombra lo pedido, con alias resueltos; `null` si no nombra ninguna. */
export function clavePedidaCarga(pedida: string | null | undefined): CargaWorkspaceTab | null {
  const limpia = pedida?.trim().toLowerCase() ?? "";
  if (!limpia) return null;
  if (esClaveCarga(limpia)) return limpia;
  if (Object.hasOwn(ALIAS_PESTANAS_CARGA, limpia)) {
    return ALIAS_PESTANAS_CARGA[limpia as keyof typeof ALIAS_PESTANAS_CARGA];
  }
  return null;
}

export type PestanaCargaResuelta = {
  pestana: CargaWorkspaceTab;
  /**
   * La pestaña que se pidió y existe en el catálogo pero no en este estudio
   * (Equivalencias con una sola base). La página avisa y deja la dirección en
   * Bases. `null` cuando lo pedido se abre o no nombra ninguna pestaña.
   */
  noDisponible: CargaWorkspaceTab | null;
};

/**
 * Resuelve la pestaña pedida contra las que este estudio ofrece. Una clave que
 * no nombra ninguna pestaña cae en Bases sin aviso, como cualquier dirección
 * sin pestaña.
 */
export function resolverPestanaCarga(
  pedida: string | null | undefined,
  disponibles: readonly CargaWorkspaceTab[],
): PestanaCargaResuelta {
  const clave = clavePedidaCarga(pedida);
  if (!clave) return { pestana: PESTANA_CARGA_POR_DEFECTO, noDisponible: null };
  if (disponibles.includes(clave)) return { pestana: clave, noDisponible: null };
  return { pestana: PESTANA_CARGA_POR_DEFECTO, noDisponible: clave };
}

/**
 * La pestaña que pide una dirección completa: `panel=variables-base` manda
 * sobre `pestana`, porque ese panel ya no existe fuera de la pestaña Variables.
 */
export function pestanaPedidaDeDireccion(direccion: {
  pestana: string | null;
  panel: string | null;
}): string | null {
  if (direccion.panel === PANEL_ALIAS_VARIABLES) return "variables";
  return direccion.pestana;
}

/** Por qué una pestaña condicional no está en el estudio, para el aviso al caer en Bases. */
const CAUSA_NO_DISPONIBLE: Partial<Record<CargaWorkspaceTab, string>> = {
  equivalencias: "Se ofrece cuando el estudio tiene dos o más bases con formularios distintos.",
};

/** El aviso que da la página cuando la dirección pide una pestaña que el estudio no tiene. */
export function avisoPestanaNoDisponible(clave: CargaWorkspaceTab): { mensaje: string; detalle?: string } {
  const etiqueta = PROCESAMIENTO_PESTANAS.carga.find((tab) => tab.key === clave)?.label ?? clave;
  const detalle = CAUSA_NO_DISPONIBLE[clave];
  return { mensaje: `"${etiqueta}" no está en este estudio`, ...(detalle ? { detalle } : {}) };
}
