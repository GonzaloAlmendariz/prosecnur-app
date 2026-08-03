import type { VarianteEvidencia } from "../criterios/CategoriaEvidencia";

/**
 * G22 · Qué tarjeta le toca a cada criterio.
 *
 * Gonzalo: «no veo en la app los cuatro tipos de tarjeta para los cuatro tipos
 * de criterios que manejamos». Y tenía razón: las cuatro variantes existían con
 * sus guards y **sólo `categoria` estaba montada**. Se construyeron, se
 * probaron, se enseñaron en el artefacto y nunca se cablearon.
 *
 * El mapa vive aquí y no repartido por seis componentes, porque la pregunta —¿de
 * qué tipo es este criterio?— tiene una sola respuesta correcta y conviene que
 * tenga un solo sitio donde se dé.
 *
 * | variante     | la pregunta                | criterios                       |
 * |--------------|----------------------------|---------------------------------|
 * | `categoria`  | ¿esta categoría entra?     | modalidad, tipo de sesión, …    |
 * | `umbral`     | ¿dónde corto?              | mínimo, matriculados, nivel     |
 * | `proporcion` | ¿qué prevalencia exijo?    | composición (las tres)          |
 * | `unidad`     | ¿este curso-horario entra? | selección uno a uno             |
 */
const UMBRAL = new Set([
  "minEligible", "elegibles_por_aula", "enrolled_total", "course_level",
  /*
   * G25 · Composición vuelve a `umbral`, y la razón es un error mío que llegó a
   * pantalla.
   *
   * Medido en la app: sus tarjetas mostraban «Q1 23 %, mediana 30 %, media
   * 31,1 %» y un eje que llegaba a **200 %**. Pero eso no son porcentajes: son
   * **alumnos elegibles por curso-horario**, la misma distribución que publica
   * el motor para todos los criterios. Un porcentaje no puede pasar de 100, y
   * «mediana 30 %» se lee como «la mitad de los cursos tiene 30 % de
   * prevalencia» cuando significa «la mitad tiene 30 alumnos».
   *
   * El error fue etiquetar el eje con la unidad del **umbral** —que sí es un
   * porcentaje— en vez de con la del **dato**. Son cosas distintas: el control
   * fija una proporción, el gráfico describe un conteo.
   *
   * La variante `proporcion` se conserva en el componente para cuando el motor
   * publique una distribución que de verdad sea una proporción. Hasta entonces
   * no la usa nadie, y eso es mejor que usarla sobre un dato que no lo es.
   */
  "composition", "c7", "c8", "c8_facultad",
]);
const PROPORCION = new Set<string>([]);
const UNIDAD = new Set(["manual_excluded"]);

export function varianteDeCriterio(criterioId: string | null | undefined): VarianteEvidencia {
  const id = (criterioId ?? "").trim();
  if (UNIDAD.has(id)) return "unidad";
  if (UMBRAL.has(id)) return "umbral";
  if (PROPORCION.has(id)) return "proporcion";
  // `composition` llega con sufijos por sub-regla (`composition_facultad`…).
  if (id.startsWith("composition")) return "umbral";
  return "categoria";
}

/** La unidad del eje cambia con la variante, y el eje se rotula con ella. */
export function unidadEjeDeCriterio(variante: VarianteEvidencia): string {
  return variante === "proporcion"
    ? "% de alumnos elegibles dentro del curso-horario"
    : "estudiantes elegibles por curso-horario";
}
