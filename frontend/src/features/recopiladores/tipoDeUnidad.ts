// El tipo de unidad del plan, en el idioma de quien sale a campo. Lo leen la
// barra del módulo y el catálogo de materiales (qué tipo admite cada material).

/**
 * El tipo de unidad, dicho como se dice.
 *
 * La barra enseñaba `classroom_course_schedule` —la clave del adaptador— junto a
 * «TIPO». Es el nombre con el que el motor distingue una familia de plan, no
 * algo que nadie diga: en la app, en el libro y en campo son «cursos-horario».
 *
 * Una clave que no esté aquí se muestra tal cual: inventarle un nombre sería
 * peor que enseñar la clave, porque el lector no podría contrastarla con nada.
 */
export const TIPO_DE_UNIDAD: Record<string, string> = {
  classroom_course_schedule: "Cursos-horario",
  household: "Viviendas",
  person: "Personas",
};

/** Rótulo del tipo de unidad; una clave desconocida se muestra tal cual. */
export function tipoDeUnidad(clave: string): string {
  return TIPO_DE_UNIDAD[clave] ?? clave;
}
