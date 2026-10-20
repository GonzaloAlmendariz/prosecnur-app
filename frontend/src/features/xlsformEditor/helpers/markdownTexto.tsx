// Pinta el texto de una pregunta, nota u opción con la regla de markdownPregunta.ts (Cuestionario y Probar).

import { textoPreguntaHtml, type LectorReferencias } from "./markdownPregunta";

const SIN_REFERENCIAS: LectorReferencias = { etiquetaDe: () => undefined };

export function TextoPregunta({ texto, lector = SIN_REFERENCIAS, como = "span", className }: {
  texto: string;
  lector?: LectorReferencias;
  como?: "span" | "p" | "h3";
  className?: string;
}) {
  const Tag = como;
  // textoPreguntaHtml escapa el texto y sólo emite el subconjunto de marcas de XLSForm.
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: textoPreguntaHtml(texto, lector) }} />;
}
