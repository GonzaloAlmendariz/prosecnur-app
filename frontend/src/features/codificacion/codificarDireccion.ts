// Dirección de una pregunta en Codificar (pestaña `codificar`, `foco` = la
// pregunta marcada). La usan los avisos de Adaptación para llevar a donde se
// arregla lo que avisan.

export function urlCodificarPregunta(pregunta: string): string {
  const sp = new URLSearchParams({ pestana: "codificar", foco: pregunta });
  return `/codificacion?${sp.toString()}`;
}
