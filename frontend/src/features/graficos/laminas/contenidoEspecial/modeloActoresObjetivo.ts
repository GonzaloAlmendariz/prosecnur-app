/** Los actores del objetivo como el textarea los muestra: uno por línea. */
export function textoDeActores(actores: unknown): string {
  return Array.isArray(actores) ? actores.filter((a): a is string => typeof a === "string").join("\n") : "";
}

/** Del textarea al plan: una línea por actor, tal cual (un Enter abre la línea siguiente). Las vacías las descarta el
 * motor (`.lam_laminas_objetivo`), así que no hace falta limpiarlas aquí y hacerlo impediría escribir. */
export function actoresDesdeTexto(texto: string): string[] {
  return texto ? texto.split("\n") : [];
}

/** Cuántos actores saldrán en la lámina. */
export function actoresQueSalen(actores: unknown): number {
  return Array.isArray(actores) ? actores.filter((a) => typeof a === "string" && a.trim()).length : 0;
}
