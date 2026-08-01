/**
 * El borrador de metas de una sección de cuotas telefónicas.
 *
 * Por qué existe: ajustar metas era inmanejable porque **cada edición era una
 * decisión**. Confirmar campo por campo —al salir del input— seguía disparando
 * un guardado y un recálculo completo por cada meta tocada: con dos actores son
 * dos recálculos de universo, brecha, tasa requerida y reserva para un cambio
 * que la persona piensa como uno solo. Con más categorías, uno por cada una.
 *
 * La regla es que **ajustar y confirmar son dos actos distintos**: las metas se
 * acumulan en un borrador local que no toca el servidor, y el recálculo ocurre
 * una vez, cuando se confirma. Hasta entonces las cifras derivadas siguen
 * mostrando el último estado calculado, que es el que sigue siendo cierto.
 *
 * Vive aparte de TelefonicoMonitoreoPage.tsx porque ese archivo está congelado
 * a crecimiento (agentic/manifest.json) y porque la regla merece test propio.
 */

export type MetasPendientes = Record<string, number>;

/**
 * Las claves del borrador que de verdad cambian algo.
 *
 * Reescribir 80 sobre una meta que ya vale 80 no es un cambio pendiente: si
 * contara, el botón de confirmar se encendería por pasar por un campo sin
 * tocarlo, y confirmar guardaría y recalcularía sin motivo.
 */
export function metasQueCambian(
  pendientes: MetasPendientes,
  metaGuardada: (value: string) => number,
): string[] {
  return Object.keys(pendientes)
    .filter((value) => pendientes[value] !== metaGuardada(value))
    .sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Aplica el borrador entero sobre las metas guardadas, en una sola pasada.
 *
 * El aplicador se inyecta porque `phoneQuotaUpsertGoal` es local a cada página
 * de perfil: duplicarlo aquí sería una segunda definición de la misma regla, y
 * ya hay dos —telefónico y acreditación— que conviene no volver tres.
 *
 * Solo se aplican las claves que cambian, así el resultado es idéntico al
 * objeto original cuando no hay nada pendiente y quien lo consume puede
 * comparar por identidad.
 */
export function aplicarMetasPendientes<G>(
  goals: G[],
  pendientes: MetasPendientes,
  metaGuardada: (value: string) => number,
  upsert: (goals: G[], value: string, meta: number) => G[],
): G[] {
  const cambios = metasQueCambian(pendientes, metaGuardada);
  if (!cambios.length) return goals;
  return cambios.reduce((acc, value) => upsert(acc, value, pendientes[value]), goals);
}

/** Qué dice el botón de confirmar según cuántas metas esperan. */
export function etiquetaDeConfirmacion(cantidad: number): string {
  if (cantidad <= 0) return "Metas confirmadas";
  return cantidad === 1 ? "Confirmar 1 meta" : `Confirmar ${cantidad} metas`;
}
