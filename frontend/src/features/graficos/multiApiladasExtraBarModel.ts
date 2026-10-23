type MultiApiladasArgs = Record<string, unknown>;

function asRecord(value: unknown): MultiApiladasArgs {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as MultiApiladasArgs
    : {};
}

/**
 * Mezcla un patch en los args de la lámina o de un bloque. Los `overrides` se fusionan clave a clave. La barra extra ya
 * no se deriva de nada (no hay `top2box` que traducir): `barra_extra` es una clave más, y `null` la quita para que el
 * bloque o la lámina vuelva a heredar (bloque > lámina > preset, `barraExtra.ts`).
 */
export function mergeMultiApiladasArgsPatch(
  current: MultiApiladasArgs,
  patch: MultiApiladasArgs,
): MultiApiladasArgs {
  const merged: MultiApiladasArgs = { ...current, ...patch };
  if (merged.barra_extra == null) delete merged.barra_extra;
  const currentOverrides = asRecord(current.overrides);
  const patchOverrides = asRecord(patch.overrides);
  if (Object.keys(currentOverrides).length || Object.keys(patchOverrides).length) {
    merged.overrides = { ...currentOverrides, ...patchOverrides };
  }
  return merged;
}
