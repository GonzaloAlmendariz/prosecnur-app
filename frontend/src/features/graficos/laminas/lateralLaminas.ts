// Estructura e Inspector son mutuamente excluyentes (decisión de Gonzalo, 2026-10-10: «o tengo la barra lateral del
// orden del PPT abierta o tengo las configuraciones del otro lateral»). Cuál está abierto vive en la dirección
// (`panel=estructura` | `panel=inspector`) y se recuerda por sesión; la lámina ocupa el resto.

export type Lateral = "estructura" | "inspector";

export const LATERALES: readonly Lateral[] = ["estructura", "inspector"];

export function esLateral(panel: string | null | undefined): panel is Lateral {
  return panel === "estructura" || panel === "inspector";
}

export type ResolucionLateral = {
  lateral: Lateral | null;
  /** La URL no dice el lateral abierto y hay que escribirlo (enlazable). */
  escribirEnUrl: boolean;
  /** La URL pide un lateral distinto del recordado: la preferencia se pone al día. */
  actualizarPreferencia: boolean;
};

/**
 * `panel` de la URL contra la preferencia de la sesión. Otro panel en la URL (avisos, bibliotecas) no cierra el
 * lateral: se superpone y, al cerrarse, el lateral recordado sigue ahí.
 */
export function resolverLateral(panelUrl: string | null | undefined, preferido: Lateral | null): ResolucionLateral {
  if (esLateral(panelUrl)) {
    return { lateral: panelUrl, escribirEnUrl: false, actualizarPreferencia: panelUrl !== preferido };
  }
  if (!panelUrl) return { lateral: preferido, escribirEnUrl: preferido !== null, actualizarPreferencia: false };
  return { lateral: preferido, escribirEnUrl: false, actualizarPreferencia: false };
}
