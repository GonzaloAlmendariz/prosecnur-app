// Texto de la sección «Significancia estadística» de Cruces (P-A9). Describe lo
// que hace el motor (`api/R/reporte_cruces.R`): letras por par de columnas de
// una misma variable de cruce, con corrección de Bonferroni. En el modo
// estándar compara proporciones con una prueba z (`comparar_columnas_sig`) y,
// en preguntas de grupos repetidos, con contrastes cluster-robust por persona;
// en el modo de dimensiones compara promedios con t de Welch
// (`comparar_medias_sig`). Nunca asteriscos ni chi².

export type ModoCruces = "estandar" | "dimensiones";

// La pestaña genera siempre con este nivel; el motor lo acepta configurable.
export const ALFA_CRUCES = 0.05;

export function formatoAlfa(alfa: number): string {
  return Number.isFinite(alfa) && alfa > 0 && alfa < 1 ? String(alfa) : String(ALFA_CRUCES);
}

export function subtituloSignificancia(): string {
  return "Compara las columnas de cada variable de cruce, par por par, y marca con letras las diferencias significativas.";
}

export function detalleSignificancia(modo: ModoCruces, alfa: number = ALFA_CRUCES): string {
  const nivel = formatoAlfa(alfa);
  if (modo === "dimensiones") {
    return `Prueba t de Welch con corrección de Bonferroni, nivel de significancia ${nivel}. `
      + "Una letra en la celda indica que ese promedio es mayor que el de la columna con esa letra.";
  }
  return `Prueba z de diferencia de proporciones con corrección de Bonferroni, nivel de significancia ${nivel}. `
    + "Una letra en la celda indica que esa proporción es mayor que la de la columna con esa letra. "
    + "En preguntas de grupos repetidos el contraste es cluster-robust por persona.";
}
