// ⌘1…⌘8 (Ctrl+1…8 en Windows) abre el módulo N del dock (L30, maqueta m/L30-paleta).
//
// El orden es el del dock: los módulos activos de la app que el proyecto agregó, en el orden del manifiesto. Así el
// número coincide con la posición que el usuario ve arriba, y un módulo que no está en el dock no tiene atajo.

import { PROSECNUR_PRIMARY_ACTIVE_MODULES } from "../../lib/modules";

export type ModuloDelDock = { slug: string; to: string; title: string };

export function modulosDelDock(agregados: readonly string[]): ModuloDelDock[] {
  return PROSECNUR_PRIMARY_ACTIVE_MODULES
    .filter((modulo) => agregados.includes(modulo.slug))
    .map((modulo) => ({ slug: modulo.slug, to: modulo.to, title: modulo.title }));
}

/** El destino de ⌘N, o null si la tecla no es 1–8 o no hay módulo en esa posición. */
export function destinoDeAtajo(tecla: string, agregados: readonly string[]): ModuloDelDock | null {
  if (!/^[1-8]$/.test(tecla)) return null;
  return modulosDelDock(agregados)[Number(tecla) - 1] ?? null;
}

/** Escribir en un campo no dispara atajos globales. */
export function estaEscribiendo(objetivo: EventTarget | null): boolean {
  const el = objetivo as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}
