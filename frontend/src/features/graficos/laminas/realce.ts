// Realce de las barras agrupadas y categóricas (ítem 10 de la oleada del inspector, 2026-11-08): un solo control,
// «Destacar», con «La más alta» como primera ficha y luego las respuestas. Antes había dos («Resaltar la barra más alta»,
// un interruptor, y «Destacar») que podían contradecirse: las elegidas mandan sobre la mayor en el motor y en la maqueta.
// Aquí son excluyentes: elegir «La más alta» suelta las respuestas y elegir una respuesta apaga la mayor. Se guarda donde
// el motor ya lee (`overrides.resaltar_mayor`, `overrides.resaltar_opciones`). Puro.

export const GRAFICOS_CON_RESALTE = new Set(["p_barras_agrupadas", "p_barras_categoricas"]);

type Args = Readonly<Record<string, unknown>>;
const overridesDe = (args: Args): Record<string, unknown> =>
  args.overrides && typeof args.overrides === "object" && !Array.isArray(args.overrides) ? { ...(args.overrides as Record<string, unknown>) } : {};

/** `resaltar_mayor` guardado (en `overrides` o, de antes, en el arg). Lo lee también la ficha de la maqueta. */
export function resaltaMayor(args: Record<string, unknown>): boolean {
  const ov = overridesDe(args);
  return (ov.resaltar_mayor ?? args.resaltar_mayor) === true;
}

/** Apaga la mayor en `ov`: borra la clave, o la deja en `false` si un arg viejo la encendería igual. */
function sinMayor(ov: Record<string, unknown>, args: Args): void {
  if (args.resaltar_mayor === true) ov.resaltar_mayor = false;
  else delete ov.resaltar_mayor;
}

/** «La más alta» rige: encendida y sin respuestas elegidas (las elegidas mandan). */
export function mayorActiva(args: Record<string, unknown>, elegidas: readonly string[]): boolean {
  return !elegidas.length && resaltaMayor(args);
}

/** El `overrides` tras pulsar «La más alta»: la enciende soltando las respuestas, o la apaga. */
export function conMayorAlternada(args: Record<string, unknown>, elegidas: readonly string[]): Record<string, unknown> {
  const ov = overridesDe(args);
  if (mayorActiva(args, elegidas)) sinMayor(ov, args);
  else { ov.resaltar_mayor = true; delete ov.resaltar_opciones; }
  return ov;
}

/** El `overrides` con estas respuestas destacadas; con alguna, la mayor se apaga. */
export function conRespuestasDestacadas(args: Record<string, unknown>, respuestas: readonly string[]): Record<string, unknown> {
  const ov = overridesDe(args);
  if (respuestas.length) { ov.resaltar_opciones = [...respuestas]; sinMayor(ov, args); }
  else delete ov.resaltar_opciones;
  return ov;
}
