/**
 * La forma corta de una facultad para las pantallas de Monitoreo.
 *
 * **El normalizador ya no vive aquí**: subió a `src/lib/nombresDeFacultad.ts`
 * porque Recopiladores tenía el suyo y los dos daban resultados distintos para
 * la misma facultad. Se re-exporta para no tocar a sus diecisiete importadores.
 *
 * Lo que se queda es el ACORTADO, y se queda a propósito: aquí se abrevia para
 * la etiqueta de un gráfico y en Recopiladores para una columna de 160 px. Dos
 * anchos, dos respuestas legítimas.
 *
 * **El archivo se llama por la función y no por la cosa** —`facultadEnPalabras`
 * y no `nombreDeFacultad`— porque ya existe `NombreDeFacultad.tsx`, el
 * componente que pinta un nombre y pone el foco. En un disco que no distingue
 * mayúsculas los dos son el mismo archivo, y el typecheck lo cazó al primer
 * import.
 */
import { facultadEnPalabras } from "../../../../lib/nombresDeFacultad";

export { facultadEnPalabras };

/**
 * La forma corta para un gráfico, donde el nombre entero no cabe sin pisar al
 * de al lado.
 *
 * Se acorta DESPUÉS de normalizar, nunca en vez de: acortar y normalizar son
 * dos trabajos y mezclarlos fue justo lo que dejó dos grafías en el mapa.
 */
export function facultadCorta(nombre: string | null | undefined): string {
  const n = facultadEnPalabras(nombre);
  if (!n) return "";
  return n
    .replace(/^Estudios Generales /i, "EE.GG. ")
    // El libro la abrevia ya en origen —«CIENCIAS Y ARTES DE LA COMUN.»—, así
    // que la regla mira el prefijo y no el nombre entero.
    .replace(/^Ciencias y Artes de la Comun.*/i, "CC. y Artes Com.")
    .replace(/^Ciencias Sociales.*/i, "Ciencias Sociales")
    .replace(/^Gastronom[ií]a.*/i, "Gastronomía")
    .replace(/^Gesti[oó]n y Alta Direcci[oó]n.*/i, "Gestión")
    .replace(/^Letras y Ciencias Humanas.*/i, "Letras y CC.HH.")
    .replace(/^Arquitectura y Urbanismo.*/i, "Arquitectura")
    .replace(/^Ciencias e Ingenier[ií]a.*/i, "CC. e Ingeniería")
    .replace(/^Ciencias Contables.*/i, "CC. Contables");
}
