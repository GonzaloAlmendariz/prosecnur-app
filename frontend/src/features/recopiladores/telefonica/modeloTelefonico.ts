// Utilidades puras de la campaña telefónica (P10), fuera de los componentes para que
// el Fast Refresh no invalide el módulo de la vista.

/** Lista separada por comas, punto y coma o salto de línea → elementos sin vacíos ni repetidos. */
export function partirLista(texto: string): string[] {
  return [...new Set(texto.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean))];
}
