// Un aviso dicho DENTRO de su lámina (Inspector y visor; H12 del checklist de usabilidad, 2026-11-05). Los avisos del
// informe se rotulan «Lámina 3, “Título” (Un gráfico): …» (`rotuloLamina`, y `.aviso_lamina` en el backend) para
// poder leerse sueltos; dentro de la lámina ese rótulo sobra y traía el punto medio a la vista. Aquí se quita el
// rótulo de la lámina, el código técnico del final y cualquier otro punto medio pasa a coma. El punto medio va escrito
// como `\u00b7` para que el contrato P3 (puntoMedio.contract.test.ts) no cuente esta línea como separador.

const PREFIJO = /^Lámina\s+\d+(?:\s+de\s+«[^»]*»)?(?:\s*[\u00b7,]\s*[“"«][^”"»]*[”"»])?(?:\s*\([^)]*\))?\s*:\s*/u;
const CODIGO_FINAL = /\s*\u00b7\s*(?:E_|HTTP_)[A-Z0-9_]+\s*$/u;
const PUNTO_MEDIO = /\s*\u00b7\s*/gu;

export function avisoDentroDeLamina(texto: string): string {
  const sin = texto.replace(PREFIJO, "").replace(CODIGO_FINAL, "").replace(PUNTO_MEDIO, ", ").trim();
  if (!sin) return texto.trim();
  return sin.charAt(0).toLocaleUpperCase("es") + sin.slice(1);
}
