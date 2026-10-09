/**
 * Readiness del Explorador de bases (AD6-E15).
 *
 * «false» significa «aún no resolvió qué mostrar», no «no hay nada que
 * mostrar». Antes la marca era `columnas.length`, así que un error de lectura,
 * una base sin columnas o un cruce sin filas quedaban en false para siempre —
 * estados terminales que el QA esperaba hasta el timeout— y, al revés, nada
 * distinguía la lectura en curso de un vacío legítimo.
 *
 * Es false mientras se lee una base de archivo: con la lectura en curso, o en
 * el primer render, antes de que el efecto la arranque (fuente de archivo sin
 * perfil ni error todavía).
 */
export type ExploradorReadinessInput = {
  fuenteTipo: "archivo" | "marco" | null;
  cargando: boolean;
  tienePerfil: boolean;
  error: string | null;
};

export function exploradorListo({ fuenteTipo, cargando, tienePerfil, error }: ExploradorReadinessInput): boolean {
  if (cargando) return false;
  if (fuenteTipo === "archivo" && !tienePerfil && !error) return false;
  return true;
}
