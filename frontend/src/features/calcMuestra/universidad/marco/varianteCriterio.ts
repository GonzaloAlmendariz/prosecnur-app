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
const UMBRAL = new Set(["minEligible", "elegibles_por_aula", "enrolled_total", "course_level"]);
const PROPORCION = new Set(["composition", "c7", "c8", "c8_facultad"]);
const UNIDAD = new Set(["manual_excluded"]);

export function varianteDeCriterio(criterioId: string | null | undefined): VarianteEvidencia {
  const id = (criterioId ?? "").trim();
  if (UNIDAD.has(id)) return "unidad";
  if (UMBRAL.has(id)) return "umbral";
  // `composition` llega con sufijos por sub-regla (`composition_facultad`…), así
  // que el prefijo decide: son la misma pregunta sobre la misma escala.
  if (PROPORCION.has(id) || id.startsWith("composition")) return "proporcion";
  return "categoria";
}

/** La unidad del eje cambia con la variante, y el eje se rotula con ella. */
export function unidadEjeDeCriterio(variante: VarianteEvidencia): string {
  return variante === "proporcion"
    ? "% de alumnos elegibles dentro del curso-horario"
    : "estudiantes elegibles por curso-horario";
}
