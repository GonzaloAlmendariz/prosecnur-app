/**
 * El nombre de una facultad en el ancho que hay.
 *
 * Las facultades llegan del marco en MAYÚSCULAS y largas: «ESTUDIOS GENERALES
 * CIENCIAS» y «ESTUDIOS GENERALES LETRAS» miden 27 caracteres y comparten los
 * 19 primeros. En una columna de 160px las dos se truncaban en «ESTUDIOS
 * GENERALES …» —dos filas visualmente idénticas con números distintos, que es
 * peor que no mostrarlas.
 *
 * Las abreviaturas no se inventan: son las que se usan al hablar del estudio
 * («EE.GG. Letras», «EE.GG. Ciencias»). El nombre completo se conserva en el
 * `title` de la fila, así que abreviar no pierde el dato, sólo lo mueve.
 */

const ABREVIATURAS: Array<[RegExp, string]> = [
  [/^ESTUDIOS\s+GENERALES\s+CIENCIAS$/i, "EE.GG. Ciencias"],
  [/^ESTUDIOS\s+GENERALES\s+LETRAS$/i, "EE.GG. Letras"],
  [/^ESCUELA\s+DE\s+ESTUDIOS\s+ESPECIALES$/i, "Estudios Especiales"],
  [/^ESCUELA\s+DE\s+POSGRADO$/i, "Posgrado"],
  [/^CIENCIAS\s+Y\s+ARTES\s+DE\s+LA\s+COMUN/i, "Ciencias y Artes de la Com."],
  [/^GASTRONOM[ÍI]A,?\s+HOTELER[ÍI]A\s+Y\s+TURISMO$/i, "Gastronomía y Hotelería"],
  [/^LETRAS\s+Y\s+CIENCIAS\s+HUMANAS$/i, "Letras y CC. Humanas"],
  [/^GESTI[ÓO]N\s+Y\s+ALTA\s+DIRECCI[ÓO]N$/i, "Gestión y Alta Dirección"],
];

/** Minúsculas con inicial mayúscula, respetando las partículas del castellano. */
const MINUSCULAS = new Set(["y", "e", "de", "del", "la", "las", "los", "en"]);

function capitalizar(nombre: string): string {
  return nombre
    .toLocaleLowerCase("es")
    .split(/(\s+)/)
    .map((parte) => {
      if (/^\s+$/.test(parte) || parte === "") return parte;
      // Una partícula en medio va en minúscula; al principio, no.
      if (MINUSCULAS.has(parte)) return parte;
      return parte.charAt(0).toLocaleUpperCase("es") + parte.slice(1);
    })
    .join("")
    .replace(/^./, (c) => c.toLocaleUpperCase("es"));
}

export function nombreCortoDeFacultad(facultad: string): string {
  const limpio = (facultad ?? "").trim();
  if (!limpio) return "";
  for (const [patron, corto] of ABREVIATURAS) {
    if (patron.test(limpio)) return corto;
  }
  return capitalizar(limpio);
}
