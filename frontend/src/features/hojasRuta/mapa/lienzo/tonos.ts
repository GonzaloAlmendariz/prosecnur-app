/**
 * Tono de identidad de cada distrito (y de cada encuestador) por su posición. Los
 * ocho primeros son tokens (`--pulso-mapa-tono-0..7`); del noveno en adelante se
 * generan girando el matiz por el ángulo áureo, para que con 20 distritos ninguno
 * repita color. Saturación y luminosidad parecidas a las de los tokens.
 */
export const TONOS_TOKEN = ["--pulso-mapa-tono-0", "--pulso-mapa-tono-1", "--pulso-mapa-tono-2", "--pulso-mapa-tono-3", "--pulso-mapa-tono-4", "--pulso-mapa-tono-5", "--pulso-mapa-tono-6", "--pulso-mapa-tono-7"];

/** Matiz generado para la posición `i` (≥ 8). */
export function tonoGenerado(i: number): string {
  const matiz = Math.round((i * 137.508 + 25) % 360);
  const luz = i % 2 ? 46 : 58;
  return `hsl(${matiz} 52% ${luz}%)`;
}

/** Color CSS del tono `i`: var(--token) para los ocho primeros, hsl() después. */
export const tonoCss = (i: number) => (i < 0 ? "var(--pulso-module-routes)" : i < TONOS_TOKEN.length ? `var(${TONOS_TOKEN[i]})` : tonoGenerado(i));
