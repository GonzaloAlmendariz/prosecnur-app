// Texto plano a partir de un rótulo que puede traer marcado HTML.
//
// Los XLSForm de Kobo admiten HTML en los rótulos (`<span style="color:#002060">`)
// y el backend los entrega tal cual. Pintarlos con dangerouslySetInnerHTML
// sería abrir la puerta a lo que traiga el formulario, así que se quita el
// marcado y se decodifican las entidades básicas.

const ENTIDADES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&#39;": "'",
  "&#039;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** Quita etiquetas HTML, decodifica entidades básicas y compacta espacios. */
export function textoPlano(valor: string | null | undefined): string {
  if (!valor) return "";
  const sinEtiquetas = valor
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-zA-Z][^<>]*>/g, "");
  // Las entidades se decodifican al final y en una sola pasada: «&amp;lt;» es
  // el texto «&lt;», no una etiqueta.
  const decodificado = sinEtiquetas.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#0?39);/g, (m) => ENTIDADES[m] ?? m);
  return decodificado.replace(/\s+/g, " ").trim();
}
