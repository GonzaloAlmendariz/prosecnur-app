// Tono del módulo para todo lo que se dibuja en un portal (ronda de pulido, P-A6).
//
// El acento de un módulo se declara en su frame (`tokens.css`: `.pulso-carga-frame`,
// `.mon-module-chrome`…) y baja por herencia. Un diálogo, sideover o popover en
// portal se monta como hijo directo de `document.body`, FUERA de ese frame: no
// hereda nada y cae al navy global. Cada overlay lo parchaba por su cuenta
// (`.pulso-gv2-estilo-dialog`, `.pulso-armon`…), y el que no lo hacía —o lo hacía a
// medias, sólo `--module-accent` y no `--pulso-primary`— salía con radios y botones
// navy sobre un módulo teal.
//
// Aquí se resuelve una vez para todos: el shell publica en `<body>` el tono del
// módulo activo, tomado de `MODULE_TONES` (la misma fuente que pinta `<main>`), y
// `tonoDePortales.css` lo reinyecta en cada hijo de `<body>` que no sea la raíz de
// la app. Cualquier overlay de cualquier módulo hereda su acento sin declarar nada.

import { useLayoutEffect } from "react";
import type { ProsecnurModuleMeta } from "../lib/modules";
import "./tonoDePortales.css";

export const ATRIBUTO_TONO_PORTAL = "data-pulso-tono-portal";

export type ModuloConTono = Pick<ProsecnurModuleMeta, "slug" | "tone">;

/** Lo único que se toca de `<body>`: un atributo y tres propiedades en línea. */
export type CuerpoConTono = Pick<HTMLElement, "setAttribute" | "removeAttribute"> & {
  style: Pick<CSSStyleDeclaration, "setProperty" | "removeProperty">;
};

/**
 * Variables que el shell escribe en `<body>`, con nombre propio para que nadie
 * dentro de `#root` las lea por accidente: sólo las consume `tonoDePortales.css`.
 */
export function variablesTonoPortal(modulo: ModuloConTono): Record<string, string> {
  return {
    "--pulso-portal-accent": modulo.tone.accent,
    "--pulso-portal-accent-soft": modulo.tone.accentSoft,
    "--pulso-portal-accent-border": modulo.tone.accentBorder,
  };
}

const NOMBRES_TONO_PORTAL = [
  "--pulso-portal-accent",
  "--pulso-portal-accent-soft",
  "--pulso-portal-accent-border",
] as const;

/**
 * Publica el tono de `modulo` en `cuerpo` y devuelve cómo deshacerlo. Sin módulo
 * (inicio del proyecto) no publica nada: los portales quedan con la identidad
 * global, igual que la página que los abre.
 */
export function aplicarTonoDePortales(
  cuerpo: CuerpoConTono,
  modulo: ModuloConTono | null | undefined,
): () => void {
  if (!modulo) {
    limpiarTonoDePortales(cuerpo);
    return () => undefined;
  }
  cuerpo.setAttribute(ATRIBUTO_TONO_PORTAL, modulo.slug);
  for (const [variable, valor] of Object.entries(variablesTonoPortal(modulo))) {
    cuerpo.style.setProperty(variable, valor);
  }
  return () => limpiarTonoDePortales(cuerpo);
}

function limpiarTonoDePortales(cuerpo: CuerpoConTono): void {
  cuerpo.removeAttribute(ATRIBUTO_TONO_PORTAL);
  for (const variable of NOMBRES_TONO_PORTAL) {
    cuerpo.style.removeProperty(variable);
  }
}

/** Montado una vez en el shell, junto a quien conoce el módulo activo. */
export function TonoDePortales({ modulo }: { modulo: ModuloConTono | null | undefined }) {
  const slug = modulo?.slug ?? null;
  const accent = modulo?.tone.accent ?? null;
  const accentSoft = modulo?.tone.accentSoft ?? null;
  const accentBorder = modulo?.tone.accentBorder ?? null;
  useLayoutEffect(() => {
    if (typeof document === "undefined") return undefined;
    const tono: ModuloConTono | null = slug && accent && accentSoft && accentBorder
      ? { slug, tone: { accent, accentSoft, accentBorder } }
      : null;
    return aplicarTonoDePortales(document.body, tono);
  }, [slug, accent, accentSoft, accentBorder]);
  return null;
}
