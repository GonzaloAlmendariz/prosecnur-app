import type { TabHeadingChip } from "../../../components/TabHeading";

/**
 * Los chips de contexto de Monitoreo se arman como texto («423 efectivas de 424
 * envíos»); el TabHeading del kit los quiere con la cifra aparte para pintarla
 * tabular y en negrita. Se separa la cifra inicial si la hay; si no, el texto
 * entero es el rótulo.
 */
export function chipsDeTexto(chips: readonly string[] | undefined): TabHeadingChip[] {
  return (chips ?? []).map((texto) => {
    const m = /^([\d.,]+\s?%?)\s+(.+)$/.exec(texto.trim());
    return m ? { id: texto, valor: m[1]!.trim(), label: m[2]! } : { id: texto, valor: "", label: texto };
  });
}
