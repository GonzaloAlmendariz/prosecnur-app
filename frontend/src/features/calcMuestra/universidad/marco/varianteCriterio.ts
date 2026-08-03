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
/*
 * G25 → G38 · Composición pasó por `umbral` y volvió a `proporcion`. El rodeo
 * vale la pena contarlo entero, porque el error intermedio parecía la solución.
 *
 * G25 midió en la app un defecto real: las tarjetas de composición mostraban
 * «Q1 23 %, mediana 30 %, media 31,1 %» y un eje que llegaba a **200 %**. Eso
 * no eran porcentajes: eran alumnos elegibles por curso-horario. Un porcentaje
 * no pasa de 100, y «mediana 30 %» se lee como «la mitad de los cursos tiene
 * 30 % de prevalencia» cuando significaba «la mitad tiene 30 alumnos».
 *
 * El diagnóstico era correcto —se estaba rotulando el gráfico con la unidad del
 * **umbral** en vez de con la del **dato**— pero la reparación fue por el lado
 * equivocado: cambió la etiqueta para que dijera la verdad sobre un dato que no
 * describía el criterio, en vez de traer el dato que sí lo describe. Composición
 * se quedó decidiéndose con un corte en % mientras su gráfico contaba alumnos.
 *
 * G38 lo repara por el otro lado, con Gonzalo señalándolo: «la distribución y el
 * boxplot debían hacer referencia al porcentaje de su composición». El motor ya
 * calculaba esa señal; le faltaba contrato v2 y viajar en la unidad del control.
 * Ahora llega en porcentaje con su escala 0–100, y `proporcion` deja de ser una
 * variante sin usuarios.
 *
 * La lección: cuando la etiqueta y el dato no coinciden, hay dos reparaciones y
 * sólo una es la buena. Cambiar la etiqueta siempre funciona —el rótulo deja de
 * mentir— y por eso es la tentadora; pero deja la superficie describiendo algo
 * que nadie preguntó.
 */
const UMBRAL = new Set([
  "minEligible", "elegibles_por_aula", "enrolled_total", "course_level",
]);
const PROPORCION = new Set<string>(["composition", "c7", "c8", "c8_facultad"]);
const UNIDAD = new Set(["manual_excluded"]);

export function varianteDeCriterio(criterioId: string | null | undefined): VarianteEvidencia {
  const id = (criterioId ?? "").trim();
  if (UNIDAD.has(id)) return "unidad";
  if (UMBRAL.has(id)) return "umbral";
  if (PROPORCION.has(id)) return "proporcion";
  // `composition` llega con sufijos por sub-regla (`composition_facultad`…).
  if (id.startsWith("composition")) return "proporcion";
  return "categoria";
}

/** La unidad del eje cambia con la variante, y el eje se rotula con ella. */
export function unidadEjeDeCriterio(variante: VarianteEvidencia): string {
  return variante === "proporcion"
    ? "% de alumnos elegibles dentro del curso-horario"
    : "estudiantes elegibles por curso-horario";
}
