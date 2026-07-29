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
import { resolverDestino, type NivelApp } from "./arbolDeLaApp";

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
  /** Nivel del árbol de la app, cuando el destino es una pieza de la app. */
  nivel?: NivelApp;
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

/**
 * Un destino de tipo `modulo` viaja como una clave del árbol de la app: un
 * módulo, un modo, una sección o una pestaña (ver `arbolDeLaApp.ts`).
 *
 * El backend guarda esa cadena sin interpretarla: el catálogo vive en
 * `lib/modules.ts` y duplicarlo en R garantizaría que las dos copias
 * divergieran al renombrar una sección.
 */
export function identidadDeDestino(targetId: string): IdentidadDeFase {
  const nodo = resolverDestino(targetId ?? "");
  if (!nodo) {
    // Retrocompatible: una clave de dos segmentos guardada antes de que
    // existieran los modos y las pestañas sigue resolviendo por el camino viejo.
    const [slug, seccion] = (targetId ?? "").split("/");
    return identidadDeFase(slug, seccion);
  }
  const modulo = PROSECNUR_MODULES.find((m) => m.slug === nodo.moduloSlug) ?? null;
  return {
    modulo,
    seccion: null,
    icono: nodo.icono,
    href: nodo.href,
    vars: nodo.vars,
    etiquetaModulo: nodo.ruta,
    etiquetaCorta: nodo.label,
    /** Qué nivel del árbol es. El nodo lo usa para no repetir el título. */
    nivel: nodo.nivel,
  };
}

export function destinoDeModulo(slug: string, seccion?: string): string {
  return seccion ? `${slug}/${seccion}` : slug;
}

/** Todo lo que un nodo de referencia puede apuntar dentro de la app. */
export type PiezaDeLaApp = {
  /** `"<slug>"` o `"<slug>/<seccion>"`. */
  destino: string;
  modulo: string;
  seccion: string;
  label: string;
  /** Nombre del módulo, para agrupar en el selector. */
  grupo: string;
};

/**
 * Catálogo de piezas enlazables: cada módulo y cada una de sus secciones.
 *
 * Es lo que hace que el lienzo hable el idioma de la app. Un nodo puede ser
 * "Monitoreo", pero también "Procesamiento · Validación": el usuario arma su
 * ramificación con las mismas piezas que usa todos los días, no con cajas de
 * texto que solo él entiende.
 */
export function piezasDeLaApp(): PiezaDeLaApp[] {
  const out: PiezaDeLaApp[] = [];
  for (const modulo of PROSECNUR_MODULES) {
    out.push({
      destino: modulo.slug,
      modulo: modulo.slug,
      seccion: "",
      label: modulo.shortLabel,
      grupo: modulo.shortLabel,
    });
    for (const seccion of modulo.sections) {
      // Una sección que se llama igual que su módulo no aporta una pieza
      // distinta: sería el mismo destino con otro nombre.
      if (seccion.label === modulo.shortLabel) continue;
      out.push({
        destino: destinoDeModulo(modulo.slug, seccion.id),
        modulo: modulo.slug,
        seccion: seccion.id,
        label: seccion.label,
        grupo: modulo.shortLabel,
      });
    }
  }
  return out;
}
