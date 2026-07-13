// Lógica pura de la vista de esquema del instrumento en Carga (multibase).
//
// En un estudio con grupos repeat (ADR 0030) el `begin_repeat` vive en el
// instrumento de la base MADRE (que conserva la sección repetible); la base
// HIJA `kobo_repeat` promueve esas preguntas a top-level. Este módulo concentra
// la decisión de "qué base muestra mejor el repeat" y las etiquetas del
// selector, para que los componentes solo presenten y esto quede testeado.

import { isRepeatChildBase, type RepeatBaseLike } from "../../lib/repeatIdentity";

/** Mapa base→metadata (estructural: solo requiere la identidad repeat). */
export type EsquemaBasesMap = Record<string, RepeatBaseLike>;

/**
 * Base cuyo esquema mejor muestra el `begin_repeat`. Orden de preferencia:
 *  1. La MADRE explícita de una base hija `kobo_repeat` (`parent_base` que
 *     existe en el estudio): es la que conserva la sección repetible.
 *  2. Si hay una base hija `kobo_repeat` pero su `parent_base` no viene resuelto
 *     (proyectos donde la metadata de enlace no se persistió), la primera base
 *     que NO es hija repeat — la madre probable, que sí trae el begin_repeat.
 *  3. La base activa.
 *  4. La primera base.
 * `""` cuando no hay bases.
 */
export function defaultEsquemaBase(bases: EsquemaBasesMap | null | undefined, activeBase?: string | null): string {
  const map = bases ?? {};
  const names = Object.keys(map);
  if (names.length === 0) return "";
  // (1) Madre explícita vía parent_base.
  const linkedChild = Object.values(map).find(
    (base) => isRepeatChildBase(base) && !!base.parent_base && !!map[base.parent_base],
  );
  if (linkedChild?.parent_base && map[linkedChild.parent_base]) return linkedChild.parent_base;
  // (2) Hay hija repeat sin enlace: caer a la primera base no-hija (madre probable).
  const hasRepeatChild = Object.values(map).some((base) => isRepeatChildBase(base));
  if (hasRepeatChild) {
    const motherProxy = names.find((name) => !isRepeatChildBase(map[name]));
    if (motherProxy) return motherProxy;
  }
  // (3)/(4) Base activa, luego la primera.
  const active = String(activeBase ?? "").trim();
  if (active && map[active]) return active;
  return names[0] ?? "";
}

/** ¿Es `name` la base madre de alguna base hija repeat del estudio? */
export function isRepeatMother(bases: EsquemaBasesMap | null | undefined, name: string): boolean {
  if (!name) return false;
  const map = bases ?? {};
  return Object.values(map).some(
    (base) => isRepeatChildBase(base) && (base.parent_base ?? "") === name,
  );
}

/** Grupo repeat que cuelga de la base madre `name` (para el hint), si se conoce. */
export function repeatGroupOfMother(bases: EsquemaBasesMap | null | undefined, name: string): string | null {
  if (!name) return null;
  const map = bases ?? {};
  const child = Object.values(map).find(
    (base) => isRepeatChildBase(base) && (base.parent_base ?? "") === name,
  );
  return child?.repeat_group ?? null;
}

/**
 * Etiqueta de la opción del `<select>`, anotando su rol repeat sin depender de
 * badges (los `<option>` nativos no los admiten): la base hija repeat y la base
 * madre quedan reconocibles en el propio dropdown.
 */
export function esquemaOptionLabel(bases: EsquemaBasesMap | null | undefined, name: string): string {
  const map = bases ?? {};
  const base = map[name];
  if (base && isRepeatChildBase(base)) return `${name} · base repetible`;
  if (isRepeatMother(map, name)) return `${name} · con grupo repetible`;
  return name;
}
