/**
 * Avisar ANTES de lanzar la comparación cuando va a ser larga.
 *
 * Medido el 2026-08-21 con el motor real, aislando la causa: sobre el MISMO
 * marco de 3.142 cursos-horario y el MISMO método balanceado, una corrida
 * cuesta 57 s con objetivo global y **más de ocho minutos** con el reparto
 * real por 17 facultades. Balancear respetando diecisiete cuotas a la vez no
 * es el mismo problema más grande: es otro problema. Proyectado, la
 * comparación completa de un estudio así pasa de dos horas.
 *
 * El motor ya estima un costo (`.cm_aulas_comparar_estimated_cost`) pero es
 * `n_aulas × n_métodos × (olas + corridas)`: no mira los estratos ni distingue
 * métodos, que son justo los dos factores que dominan. Y sólo decide sync/job
 * — nunca llega al usuario.
 *
 * Así que esto NO reusa esa cifra ni promete minutos: da el aviso cualitativo
 * que falta, con los dos números que lo causan a la vista, para que quien
 * pulsa sepa a qué atenerse. Un tiempo inventado sería peor que ninguno.
 */

/** Aulas × facultades a partir del cual la espera deja de medirse en minutos. */
export const CM_COMPARAR_UMBRAL_LARGO = 10_000;

export type AvisoDuracion = {
  /** true cuando conviene avisar antes de lanzar. */
  avisar: boolean;
  /** El producto que dispara el aviso, para poder explicarlo. */
  carga: number;
};

export function avisoDuracionComparacion({
  aulas,
  facultades,
}: {
  /** Cursos-horario incluidos en el marco. */
  aulas: number;
  /** Estratos con objetivo propio en el reparto. */
  facultades: number;
}): AvisoDuracion {
  const n = Number.isFinite(aulas) && aulas > 0 ? aulas : 0;
  // Sin reparto declarado se cuenta como un solo estrato: es el caso barato
  // que se midió en 57 s, no el de 17 cuotas simultáneas.
  const f = Number.isFinite(facultades) && facultades > 0 ? facultades : 1;
  const carga = n * f;
  return { avisar: carga >= CM_COMPARAR_UMBRAL_LARGO, carga };
}
