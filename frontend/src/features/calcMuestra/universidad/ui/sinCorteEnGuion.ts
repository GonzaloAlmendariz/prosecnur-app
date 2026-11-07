/**
 * Muestra el guion entre dos letras como guion que no corta (U+2011).
 *
 * «curso-horario» aparece en casi todos los rótulos de Cálculo de muestra y el
 * navegador lo parte justo en el guion: «contacto, fecha y aplicador por curso-»
 * en una línea y «horario» en la siguiente. Sólo para pintar: el dato no cambia.
 */
export function sinCorteEnGuion(texto: string): string {
  return texto.replace(/(\p{L})-(\p{L})/gu, "$1‑$2");
}
