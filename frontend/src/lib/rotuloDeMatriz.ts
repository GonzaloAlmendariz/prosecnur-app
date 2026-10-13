/**
 * Rótulos que vienen de la matriz de equivalencias, listos para la UI.
 *
 * La matriz trae los rótulos como los escribió quien la armó: con la
 * numeración de su documento («1.», «2)», «7.1.») y con «·» como separador
 * («Tema · subtema»). En pantalla, la numeración deja ver saltos donde una
 * sección no tiene preguntas armonizadas, y «·» no es un separador de la casa.
 * Estas funciones no dependen del texto de ningún estudio: sólo de esas dos
 * formas.
 */

/**
 * Quita la numeración inicial: «1.», «2)», «7.1.», «3.2 », «10 -». Espejo
 * ampliado de `.comparativo_rotulo_seccion()` del motor, que hace lo mismo con
 * los títulos de sección del libro.
 */
export function sinNumeracion(rotulo: string): string {
  const s = rotulo.trim();
  // Un número suelto seguido de espacio («18 a 30 años») es texto, no
  // numeración: sólo se quita si lleva signo («1.», «2)», «10 -») o si es
  // jerárquico («3.2 »).
  const limpio = s
    .replace(/^(?:\d+(?:\.\d+)*\s*[.)\-–:](?!\d)|\d+(?:\.\d+)+\s)\s*/, "")
    .trim();
  // Un rótulo que es sólo un número se conserva: quitarlo lo dejaría vacío.
  return limpio || s;
}

/**
 * «A · B» se muestra «A (B)», y «A · B · C» como «A (B, C)». Un «·» al borde
 * se descarta.
 */
export function sinPuntoMedio(rotulo: string): string {
  const partes = rotulo.split("·").map((p) => p.trim()).filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes[0]} (${partes.slice(1).join(", ")})`;
}

/** Rótulo de sección o de pregunta de la matriz, como se muestra en la UI. */
export function rotuloDeMatriz(rotulo: string | null | undefined): string {
  return sinPuntoMedio(sinNumeracion(rotulo ?? ""));
}
