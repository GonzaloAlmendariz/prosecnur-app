/**
 * Interruptor de la página nueva de Hojas de ruta (ADR 0114 §8). Mientras la
 * página con el lienzo no cubra la paridad del checklist §7, la vieja sigue
 * siendo la de todos; la nueva se enciende por equipo:
 *
 *   localStorage.setItem("prosecnur:hojas-ruta:lienzo", "1")
 *
 * No va en la URL: un parámetro fuera de la gramática del ADR 0044 se colaría
 * en los enlaces que la gente comparte. Lo lee una sola función y se retira en U20.
 */

export const CLAVE_INTERRUPTOR_LIENZO = "prosecnur:hojas-ruta:lienzo";

export function lienzoHojasRutaEncendido(almacen: Pick<Storage, "getItem"> | null = typeof window === "undefined" ? null : window.localStorage): boolean {
  try {
    return almacen?.getItem(CLAVE_INTERRUPTOR_LIENZO) === "1";
  } catch {
    // Almacenamiento bloqueado (ventana privada, permisos): la página vieja.
    return false;
  }
}
