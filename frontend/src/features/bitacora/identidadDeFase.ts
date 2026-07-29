// Identidad visual de una etapa (ADR 0047).
//
// Una etapa del cronograma no es una abstracción: apunta a un módulo de la app
// —o a una sección concreta dentro de él— y hereda su ícono y su color. Ese
// sello es lo que permite reconocer de un vistazo que "Campo" es Monitoreo y
// que "Procesamiento" es la tubería de datos, sin leer la etiqueta.
//
// El mismo resolutor lo consumirá el lienzo: un nodo que referencia una etapa
// se pinta con el sello de su módulo, así una ramificación armada a mano se lee
// con el mismo vocabulario visual que la barra de módulos y el home.

import {
  moduleChromeVars,
  PROSECNUR_MODULES,
  type ProsecnurModuleMeta,
  type ProsecnurModuleSectionMeta,
} from "../../lib/modules";
import type { LucideIcon } from "../../vendor/lucide-react";

export type IdentidadDeFase = {
  modulo: ProsecnurModuleMeta | null;
  seccion: ProsecnurModuleSectionMeta | null;
  /** Ícono de la sección si la etapa apunta a una; si no, el del módulo. */
  icono: LucideIcon | null;
  /** Ruta a la que lleva la etapa. Hace la etapa accionable, no decorativa. */
  href: string;
  /** Variables `--module-accent*` para teñir la etapa con el color del módulo. */
  vars: ReturnType<typeof moduleChromeVars> | undefined;
  /** "Módulo · Sección" cuando la etapa apunta a una sección concreta. */
  etiquetaModulo: string;
  /**
   * La pieza más específica en una sola palabra: la sección si la hay, el
   * módulo si no. Para superficies compactas donde "Módulo · Sección" no cabe
   * y donde repetir el módulo no distinguiría nada — dos etapas pueden vivir
   * en el mismo módulo y solo la sección las separa.
   */
  etiquetaCorta: string;
};

const SIN_IDENTIDAD: IdentidadDeFase = {
  modulo: null,
  seccion: null,
  icono: null,
  href: "",
  vars: undefined,
  etiquetaModulo: "",
  etiquetaCorta: "",
};

/**
 * Resuelve el sello de una etapa desde el slug de módulo (y la sección
 * opcional) que declara el backend en `bitacora_fases.R`.
 *
 * Devuelve la identidad vacía si el slug no existe, en vez de inventar un
 * ícono: una etapa sin módulo real debe verse neutra, no disfrazada.
 */
export function identidadDeFase(
  moduloSlug: string | undefined,
  seccionId?: string,
): IdentidadDeFase {
  if (!moduloSlug) return SIN_IDENTIDAD;
  const modulo = PROSECNUR_MODULES.find((m) => m.slug === moduloSlug);
  if (!modulo) return SIN_IDENTIDAD;

  const seccion = seccionId
    ? (modulo.sections.find((s) => s.id === seccionId) ?? null)
    : null;

  return {
    modulo,
    seccion,
    icono: seccion?.icon ?? modulo.icon,
    href: seccion?.to ?? modulo.to ?? "",
    vars: moduleChromeVars(modulo),
    etiquetaModulo: seccion ? `${modulo.shortLabel} · ${seccion.label}` : modulo.shortLabel,
    etiquetaCorta: seccion?.label ?? modulo.shortLabel,
  };
}
