// Énfasis de un rótulo de formulario.
//
// Los XLSForm (ODK, Kobo) admiten un markdown mínimo en los rótulos:
// `*cursiva*`, `_cursiva_`, `**negrita**` y `__negrita__`. El backend los
// entrega tal cual y la app los pintaba crudos —«…*¿quién fue la persona
// agresora?*»—. Este módulo los convierte en segmentos para pintarlos como
// énfasis real, o los quita cuando el destino es texto plano (un `title`, un
// rótulo truncado, un `aria-label`).
//
// Reglas, pensadas para no comerse texto que no es énfasis:
// - El marcador abre pegado a un carácter que no es espacio y cierra pegado a
//   otro (`* nota *` no es énfasis; «2 * 3 * 4» tampoco).
// - El guion bajo sólo cuenta en borde de palabra: `p13_1_otro` es un nombre
//   de variable, no una cursiva.
// - Un marcador sin pareja se deja como está.

export type SegmentoEnfasis = {
  texto: string;
  enfasis: "fuerte" | "cursiva" | null;
};

// Orden de alternativas: los marcadores dobles antes que los simples.
const PATRON = new RegExp(
  [
    String.raw`\*\*(?=\S)([\s\S]*?\S)\*\*`,
    String.raw`(?<![\p{L}\p{N}_])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}_])`,
    String.raw`\*(?=[^\s*])([^*]*?[^\s*])\*`,
    String.raw`(?<![\p{L}\p{N}_])_(?=[^\s_])([^_]*?[^\s_])_(?![\p{L}\p{N}_])`,
  ].join("|"),
  "gu",
);

/** Parte un rótulo en segmentos con y sin énfasis. Nunca pierde texto visible. */
export function segmentosDeEnfasis(valor: string | null | undefined): SegmentoEnfasis[] {
  const texto = valor ?? "";
  if (!texto) return [];
  const out: SegmentoEnfasis[] = [];
  let desde = 0;
  for (const m of texto.matchAll(PATRON)) {
    const inicio = m.index ?? 0;
    if (inicio > desde) out.push({ texto: texto.slice(desde, inicio), enfasis: null });
    const [, fuerteAst, fuerteSub, cursivaAst, cursivaSub] = m;
    const interior = fuerteAst ?? fuerteSub ?? cursivaAst ?? cursivaSub ?? "";
    out.push({ texto: interior, enfasis: fuerteAst !== undefined || fuerteSub !== undefined ? "fuerte" : "cursiva" });
    desde = inicio + m[0].length;
  }
  if (desde < texto.length) out.push({ texto: texto.slice(desde), enfasis: null });
  return out;
}

/** El rótulo sin marcadores de énfasis: para `title`, `aria-label` y recortes. */
export function sinEnfasis(valor: string | null | undefined): string {
  return segmentosDeEnfasis(valor).map((s) => s.texto).join("");
}
