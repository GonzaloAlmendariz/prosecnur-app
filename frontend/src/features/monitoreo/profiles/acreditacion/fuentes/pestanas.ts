// Catálogo canónico de pestañas de Fuentes en el modo Acreditación.
//
// §4.1 de `docs/plan-fuentes-legibles-2026-07.md`. Dos cambios, y los dos
// tienen una razón medida en `acrconta`:
//
//   1. Las pestañas se nombran por la PREGUNTA que responden, no por el
//      servicio del que salen los datos (hallazgo A1). Y la que responde «¿de
//      dónde salen mis números?» pasa a ser la primera, no la última (A2).
//
//   2. `survey` y `collectors` se UNEN. No por ahorrar una pestaña, sino
//      porque el recopilador hereda el canal de su encuesta —la tarjeta de
//      encuesta ya lo resume con «20 heredan · 0 excepciones»—, así que hoy la
//      regla se declara en una pestaña y su excepción se decide en otra.
//
// Las claves viejas se siguen LEYENDO como alias y nunca se ESCRIBEN, igual que
// los params heredados de navegación (ADR 0044). Una dirección guardada por un
// usuario con `?pestana=collectors` tiene que seguir aterrizando donde
// corresponde.

import { Layers3, ListChecks, PlugZap } from "../../../../../vendor/lucide-react";
import type { LucideIcon } from "../../../../../vendor/lucide-react";

export type PestanaDeFuentes = "resumen" | "universo" | "encuestas";

export type PestanaDeFuentesDefinicion = {
  key: PestanaDeFuentes;
  label: string;
  detail: string;
  icon: LucideIcon;
};

export const PESTANAS_DE_FUENTES: readonly PestanaDeFuentesDefinicion[] = [
  {
    key: "resumen",
    label: "Resumen",
    detail: "De dónde vienen los datos",
    icon: PlugZap,
  },
  {
    key: "universo",
    label: "Universo",
    detail: "La base de cada actor",
    icon: Layers3,
  },
  {
    key: "encuestas",
    label: "Encuestas y recopiladores",
    detail: "Quién responde y qué cuenta",
    icon: ListChecks,
  },
];

export const PESTANA_DE_FUENTES_POR_DEFECTO: PestanaDeFuentes = "resumen";

/**
 * Claves históricas de `?pestana=`, que se leen pero no se escriben.
 *
 * `survey` y `collectors` colapsan en la misma pestaña porque su contenido se
 * unió; el usuario que tenía guardado un enlace a cualquiera de las dos aterriza
 * en la vista que ahora contiene las dos.
 */
const ALIAS: Record<string, PestanaDeFuentes> = {
  activas: "resumen",
  estado: "resumen",
  sheets: "universo",
  bases: "universo",
  survey: "encuestas",
  plataforma: "encuestas",
  collectors: "encuestas",
  recopiladores: "encuestas",
};

export function esPestanaDeFuentes(value: unknown): value is PestanaDeFuentes {
  return PESTANAS_DE_FUENTES.some((pestana) => pestana.key === value);
}

/**
 * Resuelve lo que pide la URL a una pestaña que existe.
 *
 * Devuelve la pestaña por defecto ante cualquier valor desconocido: una
 * dirección rota aterriza en el Resumen, que es lectura pura y no tiene
 * decisiones que el usuario pueda tomar por accidente.
 */
export function resolverPestanaDeFuentes(pedida: unknown): PestanaDeFuentes {
  const clave = String(pedida ?? "").trim().toLowerCase();
  if (esPestanaDeFuentes(clave)) return clave;
  return ALIAS[clave] ?? PESTANA_DE_FUENTES_POR_DEFECTO;
}

/** Las claves que la sección acepta en la URL, canónicas y heredadas. */
export function clavesAceptadasDeFuentes(): string[] {
  return [...PESTANAS_DE_FUENTES.map((pestana) => pestana.key), ...Object.keys(ALIAS)];
}
