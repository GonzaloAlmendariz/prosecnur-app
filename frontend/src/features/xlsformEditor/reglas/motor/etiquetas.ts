// Etiquetas del instrumento dentro de una frase (S7, 2026-10-17). Una etiqueta escrita en MAYÚSCULAS
// («ENCUESTADOR/A: ¿QUIÉN ERA EL O LA ENCUESTADO/A PRINCIPAL?») grita en medio de una oración: se pasa a tipo oración,
// con sus acentos. En una etiqueta así no hay forma de distinguir una sigla de una palabra, salvo que no tenga vocales
// («RMS»), y esas se conservan. Una o dos palabras en mayúsculas («ESSALUD», «Otro (ESPECIFICAR)») no gritan una frase. Una etiqueta mixta no se toca (sus mayúsculas suelen ser siglas: «ESSALUD», «VIH/SIDA»,
// «PUCP»), salvo una instrucción en mayúsculas al comienzo («ASK TO THE RESPONDENT: Do you…», «[NO PREGUNTAR] ¿Quién…»):
// dos o más palabras seguidas, alguna de seis letras o más, antes del texto en minúsculas.

const VOCAL = /[AEIOUÁÉÍÓÚÜaeiouáéíóúü]/;

/** Primera letra en mayúscula, saltando signos de apertura («¿», «¡», «[», números de pregunta como «5. »). */
function primeraMayuscula(texto: string): string {
  return texto.replace(/^([^\p{L}]*)(\p{Ll})/u, (_m, pre: string, l: string) => pre + l.toUpperCase());
}

function bajar(texto: string): string {
  return texto.replace(/\p{L}+/gu, (p) => (p.length >= 2 && p.length <= 5 && !VOCAL.test(p) && p === p.toUpperCase() ? p : p.toLowerCase()));
}

export function normalizarMayusculas(etiqueta: string): string {
  const letras = (etiqueta.match(/\p{L}/gu) ?? []).length;
  if (letras < 4) return etiqueta;
  const mayus = (etiqueta.match(/\p{Lu}/gu) ?? []).length;
  // Gritada: casi todo en mayúsculas y al menos tres palabras (una o dos, «ESSALUD», «Otro (ESPECIFICAR)», se dejan).
  const largas = (etiqueta.match(/\p{L}{2,}/gu) ?? []).length;
  if (mayus / letras > 0.7 && largas >= 3) return primeraMayuscula(bajar(etiqueta));
  // Instrucción inicial en mayúsculas: el tramo hasta la primera minúscula.
  const corte = etiqueta.search(/\p{Ll}/u);
  if (corte <= 0) return etiqueta;
  // El tramo termina en la última palabra completa antes de la minúscula.
  let prefijo = etiqueta.slice(0, corte).replace(/\p{L}+$/u, "");
  const palabras = prefijo.match(/\p{L}+/gu) ?? [];
  if (palabras.length < 2 || !palabras.some((p) => p.length >= 6)) return etiqueta;
  prefijo = primeraMayuscula(bajar(prefijo));
  return prefijo + etiqueta.slice(prefijo.length);
}
