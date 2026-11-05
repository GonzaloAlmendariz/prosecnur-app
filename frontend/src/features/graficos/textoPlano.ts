// Texto del formulario sin sus marcas de markdown, para mostrarlo en listas densas (H12 del checklist de usabilidad,
// 2026-11-05): el picker de variables enseñaba «### MÓDULO B. EXPERIENCIA…» tal cual. Sólo para mostrar: la búsqueda y
// las claves siguen sobre el texto original.

export function textoPlano(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .replace(/<[^>]+>/g, "")                                   // etiquetas HTML (<span style="color:…">)
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")                        // encabezados
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")                   // enlaces
    .replace(/(\*\*|__)(?=\S)([^\n]*?\S)\1/g, "$2")            // negrita
    .replace(/~~(?=\S)([^\n]*?\S)~~/g, "$1")                   // tachado
    .replace(/(^|[^*\p{L}\p{N}])\*(?=\S)([^*\n]*?\S)\*(?![*\p{L}\p{N}])/gu, "$1$2") // cursiva con asterisco
    .replace(/(^|[^_\p{L}\p{N}])_(?=\S)([^_\n]*?\S)_(?![_\p{L}\p{N}])/gu, "$1$2")   // cursiva con guion bajo
    .replace(/\s+/g, " ")
    .trim();
}
