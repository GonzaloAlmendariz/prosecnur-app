import { TONOS_DE_PABELLON } from "./sistemaPabellon";

/**
 * El tono de una facultad, con el MISMO sistema que el de los pabellones.
 *
 * El perfil ya tiene una paleta de identidad —ocho acentos que ciclan y se
 * pintan con `--chip-tono`— y los chips de aula la usan desde B31. Las
 * facultades salían en gris: «se ve poco profesional y frío» (Gonzalo,
 * 2026-09-09), y tenía razón — la casa ya tenía el sistema y este bloque no lo
 * estaba usando.
 *
 * El tono sale del NOMBRE, no de la posición en la lista: así una facultad
 * conserva su color aunque el orden cambie de una pantalla a otra o el sorteo
 * añada una nueva. Es la misma decisión que en los pabellones, donde el tono
 * sale de la letra y no del índice.
 */
export function tonoDeFacultad(nombre: string | null | undefined): number | null {
  const v = (nombre ?? "").trim().toUpperCase();
  if (!v) return null;
  // Suma de códigos: estable, barata y sin dependencias. No hace falta una
  // función de hash criptográfica para repartir quince nombres en ocho tonos.
  let suma = 0;
  for (let i = 0; i < v.length; i += 1) suma = (suma + v.charCodeAt(i) * (i + 1)) % 100000;
  return suma % TONOS_DE_PABELLON;
}

/** La clase del chip de una facultad, lista para el `className`. */
export function claseDeFacultad(nombre: string | null | undefined): string {
  const tono = tonoDeFacultad(nombre);
  return `aulas-chip aulas-chip-lugar${tono === null ? "" : ` es-tono-${tono}`}`;
}
