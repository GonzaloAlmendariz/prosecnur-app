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

import { facultadEnPalabras } from "../../lib/nombresDeFacultad";

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

/**
 * **La capitalización ya no se escribe aquí.**
 *
 * Había un `capitalizar()` propio que hacía el mismo trabajo que el de Monitoreo
 * y no el mismo resultado: no reponía tildes, así que esta pantalla publicaba
 * «Educacion» y «Psicologia» —mal escritas— mientras la otra publicaba
 * «Educación» y «Psicología». Medido el 2026-09-17: 11 de 16 facultades con
 * nombre distinto en las dos pantallas, y esas dos eran faltas de ortografía, no
 * estilo.
 *
 * Ahora las dos consumen `src/lib/nombresDeFacultad.ts`. Lo que se queda aquí es
 * la tabla de ABREVIATURAS, porque este ancho es de 160 px y el de un gráfico es
 * otro: unificar el acortado cambiaría etiquetas que el equipo ya lee y es una
 * decisión de producto.
 */

export function nombreCortoDeFacultad(facultad: string): string {
  const limpio = (facultad ?? "").trim();
  if (!limpio) return "";
  for (const [patron, corto] of ABREVIATURAS) {
    if (patron.test(limpio)) return corto;
  }
  return facultadEnPalabras(limpio);
}
