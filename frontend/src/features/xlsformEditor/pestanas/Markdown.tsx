import { renderMarkdownInline } from "../helpers/markdown";

// Texto del instrumento con su markdown pintado (negritas, cursivas): un mensaje de restricción o una etiqueta no se
// muestra con `**` crudos. renderMarkdownInline escapa el HTML y sólo emite el subconjunto de marcas del editor.
export function Markdown({ texto }: { texto: string }) {
  return <span dangerouslySetInnerHTML={{ __html: renderMarkdownInline(texto) }} />;
}
