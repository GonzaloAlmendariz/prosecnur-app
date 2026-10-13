// Actores consultados y dimensiones de la lámina de objetivo (G6). Viajan en `meta.actores` (nombres),
// `meta.actores_iconos` (alineado con los nombres; «» = el ícono que el motor elige por el nombre) y `meta.dimensiones`.
// Gonzalo (2026-10-13): «¿por qué no me deja escoger el ícono para cada uno y por qué para agregar uno tiene que ser con
// Enter?» — se editan como lista, una fila por actor con su ícono, y se agregan o quitan con botones.

import { ICONO_AUTOMATICO } from "../../indice/modeloIndice";

/** `.lam_objetivo_cabe`: hasta seis actores; la composición «Dimensiones y actores», hasta cuatro dimensiones. */
export const MAX_ACTORES = 6;
export const MAX_DIMENSIONES = 4;

export type Actor = { nombre: string; icono: string };

const textos = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : "")) : []);

/** Los actores de la meta, cada uno con su ícono (los proyectos guardados antes no traen íconos: todos automáticos). */
export function actoresDeMeta(meta: { actores?: unknown; actores_iconos?: unknown }): Actor[] {
  const iconos = textos(meta.actores_iconos);
  return textos(meta.actores).map((nombre, i) => ({ nombre, icono: iconos[i] ?? ICONO_AUTOMATICO }));
}

/** De la lista a la meta. Sin ningún ícono elegido no se escribe `actores_iconos`: el plan queda como antes. */
export function metaDeActores(actores: readonly Actor[]): { actores: string[]; actores_iconos?: string[] } {
  const nombres = actores.map((a) => a.nombre);
  const iconos = actores.map((a) => a.icono || ICONO_AUTOMATICO);
  return iconos.some(Boolean) ? { actores: nombres, actores_iconos: iconos } : { actores: nombres, actores_iconos: undefined };
}

/** Las dimensiones de la meta, tal como se editan (una vacía recién agregada se conserva mientras se escribe). */
export function dimensionesDeMeta(meta: { dimensiones?: unknown }): string[] {
  return textos(meta.dimensiones);
}

/** Cuántos actores saldrán en la lámina: los que tienen nombre (el motor descarta las filas vacías). */
export function actoresQueSalen(actores: unknown): number {
  return Array.isArray(actores) ? actores.filter((a) => typeof a === "string" && a.trim()).length : 0;
}
