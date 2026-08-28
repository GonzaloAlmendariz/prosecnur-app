/**
 * El estrato del plan, dicho en palabras.
 *
 * El motor compone la clave del estrato pegando las columnas de
 * `estratos_selector` —hoy `["faculty", "sex_top_1", "size_group"]`— con " / ",
 * y la pantalla la enseñaba tal cual: **«GESTIÓN Y ALTA DIRECCIÓN / F / G3»**.
 * Dos de los tres segmentos son ilegibles, y uno de ellos además engaña:
 *
 * - **`G3` no dice nada.** Es el tramo de tamaño del curso-horario, y sus cortes
 *   viven en `calc_muestra_aulas.R` (`breaks = c(-Inf, 20, 30, 40, Inf)`, con
 *   `right = TRUE`). Quien lee el gráfico de brecha por estrato no tiene forma
 *   de saber que ese estrato son aulas de 31 a 40 alumnos, que es justo el dato
 *   que decide si mandar a alguien.
 * - **`F` no significa «mujeres».** El segmento es `sex_top_1`: el sexo MÁS
 *   FRECUENTE del aula. Un estrato `F` son aulas de mayoría femenina, no aulas
 *   de mujeres. Y en el MISMO perfil, dos pestañas más allá, las celdas de cuota
 *   sí llaman `F` a las mujeres. La misma letra con dos denominadores distintos
 *   en una sola pantalla es de las confusiones más caras que tiene este módulo.
 *
 * Por eso la traducción no abrevia: dice «mayoría mujeres», que es lo que es.
 */

/** Los cortes de `size_group`, tal como los define el motor. */
const TRAMOS_DE_TAMANO: Record<string, string> = {
  g1: "hasta 20 alumnos",
  g2: "21-30 alumnos",
  g3: "31-40 alumnos",
  g4: "41 alumnos o más",
};

/** `sex_top_1`: el sexo predominante del aula, no el sexo de la cuota. */
const SEXO_PREDOMINANTE: Record<string, string> = {
  f: "mayoría mujeres",
  m: "mayoría hombres",
};

/** Traduce un segmento de la clave del estrato; lo desconocido se deja intacto. */
export function segmentoDeEstrato(segmento: string): string {
  const clave = segmento.trim().toLowerCase();
  // Lo que no se reconoce se devuelve tal cual y NO se descarta: una lista
  // cerrada que se traga lo que no entiende deja el estrato sin nombre y nadie
  // se entera.
  return TRAMOS_DE_TAMANO[clave] ?? SEXO_PREDOMINANTE[clave] ?? segmento.trim();
}

/**
 * La clave completa del estrato, legible.
 *
 * Separa con «·» y no con «/» porque los segmentos ya no son códigos cortos:
 * «GESTIÓN Y ALTA DIRECCIÓN · mayoría mujeres · 31-40 alumnos».
 */
export function etiquetaDeEstrato(clave: string): string {
  const partes = String(clave ?? "").split("/").map((p) => p.trim()).filter(Boolean);
  if (!partes.length) return String(clave ?? "");
  return partes.map(segmentoDeEstrato).join(" · ");
}
