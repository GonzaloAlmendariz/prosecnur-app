// Estructura e Inspector son mutuamente excluyentes (decisión de Gonzalo, 2026-10-10: «o tengo la barra lateral del
// orden del PPT abierta o tengo las configuraciones del otro lateral»); desde el acabado de 2026-11-08 (C1) Avisos
// también los excluye a los dos (`lateralVisible`). Cuál está abierto vive en la dirección
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

/**
 * Un solo lateral junto al lienzo (decisión C1 del acabado de Láminas, 2026-11-08): Estructura, Inspector y Avisos son
 * MUTUAMENTE EXCLUYENTES. R7-3 ya hacía que Avisos reemplazara al Inspector (a 1440 los dos juntos dejaban la lámina en
 * 576 px); ahora reemplaza también a la Estructura, que antes convivía con él, para que la lámina conserve al menos el
 * 60 % del ancho útil. Con Avisos abierto no se ve ningún otro lateral; la preferencia sigue en la sesión, así que al
 * cerrar Avisos el lateral recordado vuelve.
 */
export function lateralVisible(lateral: Lateral | null, otroPanelAbierto: boolean): Lateral | null {
  // R9-6: «otro panel» es Avisos o la Revisión de diferencias; los dos ocupan la columna del lateral.
  return otroPanelAbierto ? null : lateral;
}
