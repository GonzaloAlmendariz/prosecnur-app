type MultiApiladasArgs = Record<string, unknown>;

function asRecord(value: unknown): MultiApiladasArgs {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as MultiApiladasArgs
    : {};
}

export function mergeMultiApiladasArgsPatch(
  current: MultiApiladasArgs,
  patch: MultiApiladasArgs,
): MultiApiladasArgs {
  const currentOverrides = asRecord(current.overrides);
  const patchOverrides = asRecord(patch.overrides);
  const overrides: MultiApiladasArgs = {
    ...currentOverrides,
    ...patchOverrides,
  };
  const hasExplicitExtraBar = Object.prototype.hasOwnProperty.call(
    patchOverrides,
    "mostrar_barra_extra",
  );

  if (!hasExplicitExtraBar && Object.prototype.hasOwnProperty.call(patch, "top2box")) {
    overrides.mostrar_barra_extra = patch.top2box === true;
  } else if (!Object.prototype.hasOwnProperty.call(overrides, "mostrar_barra_extra")) {
    // Sin declaración, la columna sigue lo que ya dice la lámina: cambiar de lectura con el Top Two Box encendido no
    // lo apaga en silencio (2026-10-14).
    overrides.mostrar_barra_extra = current.top2box === true;
  }

  return {
    ...current,
    ...patch,
    overrides,
  };
}
