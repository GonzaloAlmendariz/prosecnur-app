/**
 * Subtítulo de una fila del outline del Catálogo.
 *
 * La fila ya dice QUÉ ES el bloque («Registro de aplicación»); el subtítulo
 * sólo vale si dice QUÉ PINTA y eso es distinto del rótulo. Los presets de
 * fábrica dejan en `text` el mismo nombre del tipo (y a veces sin tildes:
 * «Registro de aplicacion»), así que se compara sin mayúsculas ni tildes.
 */

const MAX_SUBTITULO = 44;

function comparable(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function subtituloDelBloque(text: string | null | undefined, rotulo: string): string {
  const texto = (text ?? "").trim();
  if (!texto) return "";
  if (comparable(texto) === comparable(rotulo)) return "";
  return texto.length > MAX_SUBTITULO ? `${texto.slice(0, MAX_SUBTITULO)}…` : texto;
}
