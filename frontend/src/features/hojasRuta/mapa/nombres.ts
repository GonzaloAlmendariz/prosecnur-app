/**
 * Nombre de distrito legible: el marco y la cobertura los traen en mayúsculas
 * («SAN JUAN DE LURIGANCHO»); el lienzo y las listas los muestran como nombre
 * propio, con las partículas en minúscula («San Juan de Lurigancho»).
 */
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "el", "y"]);

export function nombreDistrito(nombre: string): string {
  return nombre
    .toLocaleLowerCase("es-PE")
    .split(/(\s+|-)/)
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase("es-PE") + p.slice(1)))
    .join("");
}
