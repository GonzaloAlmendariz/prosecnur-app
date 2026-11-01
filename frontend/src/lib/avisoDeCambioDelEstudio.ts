/**
 * Aviso de que el estudio abierto cambió SIN cambiar de sesión: una base que
 * llegó por un import en segundo plano, por ejemplo (L31b).
 *
 * No es `pulso:session-changed`: ese evento sólo sale cuando cambia el `sid`
 * (`api/core.ts`) y quien lo escucha resetea stores enteros
 * (`useStoreResetOnSessionChange`). Reusarlo para «llegó una base» borraría
 * filtros y configuraciones del proyecto que sigue abierto. Este evento sólo
 * pide releer: el Home lo escucha para recargar sus tarjetas.
 */
export const EVENTO_CAMBIO_DEL_ESTUDIO = "pulso:estudio-cambio";

export function avisarCambioDelEstudio(origen: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_CAMBIO_DEL_ESTUDIO, { detail: { origen } }));
}
