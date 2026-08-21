/**
 * Qué anunciar cuando el marco termina de construirse.
 *
 * El aviso daba las cifras reales —eso estaba bien— pero cerraba siempre igual:
 * «El cálculo ya tiene N y estratos listos». Con criterios que no dejan pasar
 * ninguna aula eso afirma que está listo lo que no existe, y manda a Cálculo a
 * encontrarse el vacío. Es la misma familia que «Cálculo completado» anunciado
 * sobre un resultado incompatible (daf4b9be): un cierre de éxito que no mira
 * el resultado.
 *
 * No es hipotético: aplicar los criterios de un estudio a una base más chica
 * bajó el marco de 82 aulas incluidas a 33 en una prueba real, y criterios más
 * estrictos lo dejan en cero.
 */

export type AvisoMarco = { kind: "info" | "warn"; text: string };

export function avisoMarcoConstruido({
  estFrag,
  chFrag,
  estratos,
  elegiblesEstudiantes,
  elegiblesCursosHorario,
}: {
  /** Fragmento ya formateado de estudiantes elegibles. */
  estFrag: string;
  /** Fragmento ya formateado de cursos-horario elegibles. */
  chFrag: string;
  /** Facultades sincronizadas al componente; 0 si no hubo sincronía. */
  estratos: number;
  elegiblesEstudiantes: number;
  elegiblesCursosHorario: number;
}): AvisoMarco {
  const base = `Base leída y marco construido: ${
    estratos > 0 ? `${estFrag} en ${estratos} ${estratos === 1 ? "facultad" : "facultades"} y ${chFrag}` : `${estFrag} y ${chFrag}`
  }.`;

  // Sin unidades no hay nada que dimensionar, y decir «listos» sería mandar a
  // Cálculo a chocarse con un marco vacío. Se nombra la causa probable: lo que
  // deja un marco en cero son los criterios, no la base.
  if (elegiblesCursosHorario <= 0 || elegiblesEstudiantes <= 0) {
    return {
      kind: "warn",
      text: `${base} Ningún ${elegiblesCursosHorario <= 0 ? "curso-horario" : "estudiante"} pasó los criterios, así que no hay marco que dimensionar: revísalos en Marco antes de calcular.`,
    };
  }
  return { kind: "info", text: `${base} El cálculo ya tiene N y estratos listos.` };
}
