// Comillas tipográficas en expresiones XLSForm (revamp E7, 2026-10-16). Word y Excel cambian ' y " por “ ” ‘ ’
// al escribir; ODK no las reconoce y la regla falla al publicar. La sonda del corpus encontró 13+ celdas así.

const TIPOGRAFICAS = /[“”‘’]/;

/** Columnas de survey cuyo contenido es una expresión. */
export const COLUMNAS_EXPRESION = ["relevant", "constraint", "calculation", "choice_filter"] as const;

export function tieneComillasTipograficas(texto: string): boolean {
  return TIPOGRAFICAS.test(texto);
}

/** Cambia “ ” por " y ‘ ’ por '. */
export function rectificarComillas(texto: string): string {
  return texto.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

/** id del diagnóstico: el panel de fila lo reconoce para ofrecer el arreglo de un clic. */
export const idComillas = (columna: string, rowIndex: number) => `comillas-${columna}-${rowIndex}`;

export function columnaDeIdComillas(id: string): string | null {
  return id.match(/^comillas-([a-z_]+)-\d+$/)?.[1] ?? null;
}
