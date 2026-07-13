// Lectura relacional de una base hija repeat en los exploradores (ADR 0030
// Fase 5). Una base hija `kobo_repeat` NO son casos/persona sueltos: cada fila
// es una RESPUESTA-POR-INSTANCIA del roster (p.ej. una fila por servicio) y
// varias filas pueden pertenecer a la misma persona (submission madre). Este
// módulo concentra la LÓGICA PURA para que los exploradores presenten esa
// relación — qué columna vincula a la persona, qué columnas identifican la
// instancia, cómo agrupar filas contiguas de una misma persona y qué grano
// mostrar en el banner — sin acoplar a `EstudioBase` ni a la tabla de datos.
//
// La identidad visual (naranja `--pulso-repeat-*`) la ponen `RepeatBadge` /
// `RepeatGrainNote`; aquí sólo va la lógica, testeada con vitest.

import {
  isRepeatChildBase,
  safeRepeatNum,
  type RepeatBaseLike,
  type RepeatGrain,
} from "./repeatIdentity";

/**
 * Columna canónica ODK/Kobo que vincula la fila hija con su madre
 * (`child._parent_index` ↔ `parent._index`). Es el identificador estable de la
 * PERSONA a la que pertenece la respuesta.
 */
export const ROSTER_PERSON_LINK_KEY = "_parent_index";

/**
 * Columnas de identidad de la instancia del roster, emitidas por
 * `jr:choice-name()` en el XLSForm (típicamente `current_label`/`current_code`).
 * Son la identidad del "servicio/ítem" de esa fila.
 */
export const ROSTER_SERVICE_LABEL_KEYS = ["current_label"] as const;
export const ROSTER_SERVICE_CODE_KEYS = ["current_code"] as const;

/** Resultado de resolver las columnas relacionales dentro de un set de keys. */
export type RosterColumnResolution = {
  /** Columna con el vínculo a la persona (o `null` si no está presente). */
  personKey: string | null;
  /** Columna con la etiqueta de la instancia/servicio. */
  serviceLabelKey: string | null;
  /** Columna con el código de la instancia/servicio. */
  serviceCodeKey: string | null;
};

function findKey(keys: string[], needle: string): string | null {
  const target = needle.trim().toLowerCase();
  if (!target) return null;
  return keys.find((k) => k.toLowerCase() === target) ?? null;
}

function firstPresent(keys: string[], candidates: readonly string[]): string | null {
  for (const cand of candidates) {
    const hit = findKey(keys, cand);
    if (hit) return hit;
  }
  return null;
}

/**
 * Resuelve, dentro de las columnas de una base hija, cuál vincula a la persona
 * y cuáles identifican la instancia. Prioriza el `linkKey` declarado por la
 * base (metadata ADR 0030); si no llega, cae a `_parent_index` y luego a una
 * heurística `*parent_index`. Es defensivo: sólo devuelve columnas presentes.
 */
export function resolveRosterColumns(
  columnKeys: readonly string[],
  opts?: { linkKey?: string | null },
): RosterColumnResolution {
  const keys = (columnKeys ?? []).map((k) => String(k ?? ""));
  const declared = String(opts?.linkKey ?? "").trim();
  const personKey =
    (declared ? findKey(keys, declared) : null) ||
    findKey(keys, ROSTER_PERSON_LINK_KEY) ||
    keys.find((k) => /(^|[_.])parent_index$/i.test(k)) ||
    null;
  return {
    personKey,
    serviceLabelKey: firstPresent(keys, ROSTER_SERVICE_LABEL_KEYS),
    serviceCodeKey: firstPresent(keys, ROSTER_SERVICE_CODE_KEYS),
  };
}

/**
 * Etiqueta de la persona a la que pertenece una fila. El valor de
 * `_parent_index` es el `_index` (1-based) de la submission madre, así que
 * `Persona #123` se lee como "la respuesta pertenece a la persona 123".
 */
export function formatPersonTag(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  return raw ? `Persona #${raw}` : "Persona sin vínculo";
}

/** Marca de agrupamiento por persona de una fila dentro de la página actual. */
export type RosterRowMark = {
  /** Valor de la persona (crudo, tal como viene en la columna de vínculo). */
  person: string;
  /** ¿Abre un grupo (persona distinta a la fila anterior de la página)? */
  isGroupStart: boolean;
  /** ¿Cierra un grupo (persona distinta a la fila siguiente de la página)? */
  isGroupEnd: boolean;
};

/**
 * Marca cada fila de la página con la persona a la que pertenece y si abre o
 * cierra un grupo respecto de sus vecinas contiguas. La base hija se emite
 * agrupada por submission (orden natural), así que filas contiguas de una misma
 * persona quedan juntas y el explorador puede dibujar la separación visual. Si
 * no hay columna de persona, cada fila es su propio grupo (sin agrupar).
 */
export function markRosterRows(
  rows: ReadonlyArray<Record<string, string>>,
  personKey: string | null,
): RosterRowMark[] {
  const list = rows ?? [];
  if (!personKey) {
    return list.map(() => ({ person: "", isGroupStart: true, isGroupEnd: true }));
  }
  const at = (i: number): string | null => {
    if (i < 0 || i >= list.length) return null;
    return String(list[i][personKey] ?? "").trim();
  };
  return list.map((_, i) => {
    const person = at(i) ?? "";
    return {
      person,
      isGroupStart: person !== at(i - 1),
      isGroupEnd: person !== at(i + 1),
    };
  });
}

/**
 * Reordena las columnas para que la "columna vertebral" relacional quede al
 * frente: Persona (vínculo) → Servicio (etiqueta) → Código de servicio. Así
 * cada fila se lee como "servicio X de la persona P". Sólo mueve columnas
 * presentes; el resto conserva su orden. Genérico sobre `{ key }` para no
 * acoplar a la tabla de datos.
 */
export function orderColumnsForRoster<T extends { key: string }>(
  columns: T[],
  roster: RosterColumnResolution,
): T[] {
  const front = [roster.personKey, roster.serviceLabelKey, roster.serviceCodeKey].filter(
    (key): key is string => !!key,
  );
  if (front.length === 0) return columns;
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const placed = new Set<string>();
  const ordered: T[] = [];
  for (const key of front) {
    const column = byKey.get(key);
    if (column && !placed.has(key)) {
      ordered.push(column);
      placed.add(key);
    }
  }
  for (const column of columns) {
    if (!placed.has(column.key)) ordered.push(column);
  }
  return ordered;
}

/** Contexto relacional que un explorador pasa a la tabla de datos. */
export type ProcessingSheetRepeatContext = {
  /** Grano real (Analítica) si está disponible; si no, `null`. */
  grain: RepeatGrain | null;
  /** Nombre del begin_repeat (para el badge), si se conoce. */
  repeatGroup: string | null;
  /** Base madre a la que enlaza (para el tooltip), si se conoce. */
  parentBase: string | null;
  /** Llave de vínculo declarada (link_key); default `_parent_index`. */
  linkKey: string | null;
  /** N de instancias conocido (filas de la base hija), si se conoce. */
  nInstancias: number | null;
};

/**
 * Deriva el contexto relacional desde la metadata de una base. Devuelve `null`
 * si la base NO es una hija repeat (así el caller sólo activa el modo roster
 * cuando corresponde). No computa joins: sólo lee metadata ya resuelta.
 */
export function repeatContextFromBase(
  base:
    | (RepeatBaseLike & {
        n_filas?: number | null;
        link_key?: string | null;
        grain?: RepeatGrain | null;
      })
    | null
    | undefined,
): ProcessingSheetRepeatContext | null {
  if (!isRepeatChildBase(base)) return null;
  return {
    grain: base?.grain ?? null,
    repeatGroup: base?.repeat_group ?? null,
    parentBase: base?.parent_base ?? null,
    linkKey: base?.link_key ?? null,
    nInstancias: safeRepeatNum(base?.n_filas),
  };
}

/** Nota relacional para el banner cuando no llega el grano real de Analítica. */
export const ROSTER_RELATIONAL_NOTE =
  "Cada fila es un registro repetido, no una persona. La columna «Persona» indica quién respondió; las filas de una misma persona van juntas.";

/**
 * Construye el grano a mostrar en el banner del explorador. Prefiere el grano
 * real (Analítica, con instancias · personas + nota de clustering). Si no llega,
 * arma uno con el N de instancias conocido (filas de la hija) y la nota
 * relacional, para que el banner explique la lectura roster igual. Devuelve
 * `null` cuando no hay absolutamente nada útil que mostrar.
 */
export function buildExplorerGrain(input: {
  grain?: RepeatGrain | null;
  nInstancias?: number | null;
  nPersonas?: number | null;
  repeatGroup?: string | null;
  parentBase?: string | null;
}): RepeatGrain | null {
  if (input.grain) return input.grain;
  const nInst = safeRepeatNum(input.nInstancias);
  const nPers = safeRepeatNum(input.nPersonas);
  const group = String(input.repeatGroup ?? "").trim();
  const parent = String(input.parentBase ?? "").trim();
  if (nInst == null && nPers == null && !group) return null;
  return {
    kind: "instancia",
    n_instancias: nInst,
    n_personas: nPers,
    repeat_group: group,
    parent_base: parent,
    nota: ROSTER_RELATIONAL_NOTE,
  };
}
