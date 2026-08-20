/**
 * Vocabulario canónico de los niveles de equivalencia de un reemplazo.
 *
 * Gonzalo (2026-08-20): «sigo sin entender el apartado de reemplazos…
 * ¿a qué te refieres con misma celda, celda equivalente, celda sin reserva?
 * hay que definir bien el lenguaje». La palabra de la casa es «estrato»:
 * la casilla del diseño muestral (facultad y perfil) a la que el aula
 * pertenece. «Celda» era jerga interna y vivía en TRES diccionarios
 * distintos (panels, inspector, mapa) — un vocabulario, un dueño.
 */

export const GLOSA_ESTRATO =
  "El estrato es la casilla del diseño muestral (facultad y perfil) a la que " +
  "pertenece cada aula: el reemplazo ideal sale del mismo estrato de su titular, " +
  "para que la muestra no se deforme cuando un aula se cae.";

export const EQUIVALENCIA_ETIQUETAS: Record<string, string> = {
  titular: "Titular",
  misma_celda: "Mismo estrato del diseño",
  celda_equivalente: "Estrato equivalente",
  celda_cercana: "Estrato vecino",
  misma_facultad: "Misma facultad, otro estrato",
  mismo_dominio: "Mismo dominio académico",
  mismo_programa: "Mismo programa",
  cambia_programa: "Cambia de programa",
  cambia_carrera: "Cambia de carrera",
  cambia_nivel: "Cambia de nivel",
  baja_equivalencia: "Equivalencia baja",
  sin_reserva: "Sin reemplazo viable",
  desconocido: "Sin equivalencia acreditada",
};

/** Etiqueta en español del nivel que reporta el motor; nunca deja pasar la
 *  clave cruda con guiones bajos. */
export function equivalenciaEtiqueta(value: unknown, fallback = "equivalencia pendiente"): string {
  const key = String(value ?? "").trim().toLowerCase();
  if (!key) return fallback;
  return EQUIVALENCIA_ETIQUETAS[key] ?? key.replace(/_/g, " ");
}
