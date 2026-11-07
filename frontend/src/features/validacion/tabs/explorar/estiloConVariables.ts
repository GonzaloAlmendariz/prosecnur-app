import type { CSSProperties } from "react";

/** Estilo en línea con variables CSS propias (`--vx-*`), tipado sin `any`. */
export function estiloConVariables(variables: Readonly<Record<`--${string}`, string>>, base: CSSProperties = {}): CSSProperties {
  return { ...base, ...(variables as CSSProperties) };
}
