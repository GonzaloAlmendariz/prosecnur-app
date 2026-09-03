/**
 * El tono del chip de pabellón, derivado de la LETRA del edificio.
 *
 * Dictado (2026-09-02, mirando el detalle de la malla): «los pabellones con
 * números en recuadros elegantes de colores en función de la letra». El
 * contrato es determinismo puro —misma letra, mismo tono, siempre—: sin
 * reloj, sin azar y sin depender del orden en que aparezcan los lugares, para
 * que el A703 del detalle, el de la tabla de Asignación y el «A» del pie se
 * pinten idénticos en cualquier render.
 *
 * Los tonos son índices, no colores: la paleta vive en la hoja
 * (`aulasCargaDeCampo.css`, clases `es-tono-*` sobre tokens `--pulso-*`), que
 * es la única dueña del color en este frontend.
 */

/** Cuántos tonos declara la hoja. Subirlo exige declarar la clase nueva. */
export const TONOS_DE_PABELLON = 8;

/** «A703» → «A»; «lfia» → «L»; «Ñ201» → «N»; sin letra inicial → "". */
export function letraDePabellon(lugar: string): string {
  const crudo = String(lugar ?? "").trim().toUpperCase();
  const m = /^\p{L}/u.exec(crudo);
  if (!m) return "";
  // Sin tildes ni virgulilla: «Ñ» comparte tono con «N» en vez de caer fuera
  // del alfabeto y quedarse sin color.
  return m[0].normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Índice cíclico `0..TONOS-1` por letra; `null` sin letra → chip neutro. */
export function tonoDePabellon(lugar: string): number | null {
  const letra = letraDePabellon(lugar);
  if (!letra) return null;
  const codigo = letra.charCodeAt(0) - 65;
  if (codigo < 0 || codigo > 25) return null;
  return codigo % TONOS_DE_PABELLON;
}
