/**
 * Nombre de distrito legible: el marco y la cobertura los traen en mayúsculas y sin tildes
 * («SAN JUAN DE LURIGANCHO», «ANCON»); el lienzo y las listas los muestran como nombre
 * propio, con las partículas en minúscula y con sus tildes («San Juan de Lurigancho»,
 * «Ancón»): las cosas se nombran como son (revisión del 7 nov 2026).
 */
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "el", "y"]);

/**
 * Tildes por palabra de los distritos con cartografía (los 158 de limaDistrictCoverage y
 * ciudadesDistrictCoverage). Por palabra y no por nombre: «María», «Martín» o «Jesús» se repiten.
 */
const TILDES: Record<string, string> = {
  agustin: "Agustín", albarracin: "Albarracín", ancon: "Ancón", andres: "Andrés", belen: "Belén",
  caceres: "Cáceres", calleria: "Callería", carquin: "Carquín", huancan: "Huancán", huanuco: "Huánuco",
  jaen: "Jaén", jeronimo: "Jerónimo", jesus: "Jesús", jose: "José", lurin: "Lurín", maria: "María",
  martin: "Martín", monsefu: "Monsefú", peru: "Perú", rimac: "Rímac", sabandia: "Sabandía",
  sebastian: "Sebastián", tuman: "Tumán", tupac: "Túpac", union: "Unión", veintiseis: "Veintiséis",
  victor: "Víctor",
};

export function nombreDistrito(nombre: string): string {
  return nombre
    .toLocaleLowerCase("es-PE")
    .split(/(\s+|-)/)
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : TILDES[p] ?? p.charAt(0).toLocaleUpperCase("es-PE") + p.slice(1)))
    .join("");
}
