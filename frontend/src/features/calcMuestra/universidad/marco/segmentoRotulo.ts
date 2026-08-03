/**
 * F108 · El rótulo de un segmento es presentación, no dato.
 *
 * Medido en la app: la superficie decía **«Regla efectiva» 48 veces**. Ese texto
 * no está en `frontend/src` ni en `api/R` — F71 lo renombró a «Cursos-horario
 * que cumplen»—, y el proceso R vivo arrancó *después* de la reparación. Llega
 * en el dato: `segment_label` se calcula al construir el marco y **se persiste
 * dentro de él**.
 *
 * La consecuencia es que cada `.pulso` guardado lleva el vocabulario del día en
 * que se construyó su marco. Renombrar en una versión no toca los proyectos
 * existentes, y el usuario no tiene cómo enterarse de que su pantalla muestra
 * palabras retiradas. No es un cache rancio: es copy dentro de un artefacto.
 *
 * `segment_key` sí es contrato —el motor lo publica estable—, así que el rótulo
 * se resuelve aquí por llave. Un `segment_key` desconocido cae al `segment_label`
 * del payload: preferimos una palabra vieja a un hueco, y así el mapa puede ir
 * por detrás del motor sin romper nada.
 */

/** Rótulos vigentes por llave estable de segmento. */
const ROTULOS: Record<string, { ch: string; alumnos: string }> = {
  global: { ch: "Cursos-horario que cumplen", alumnos: "Estudiantes que cumplen" },
};

/** Grano de la radiografía que pide el rótulo. */
export type GranoSegmento = "ch" | "alumnos";

/**
 * Rótulo vigente de un segmento.
 *
 * @param key   `segment_key` del motor (contrato estable).
 * @param label `segment_label` del payload — puede venir de un marco viejo.
 */
export function rotuloSegmento(
  key: string | null | undefined,
  label: string | null | undefined,
  grano: GranoSegmento,
): string {
  const vigente = key ? ROTULOS[key]?.[grano] : undefined;
  return vigente ?? label ?? "";
}
