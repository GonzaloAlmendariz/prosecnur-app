// =============================================================================
// helpers/markdown.ts — render del subset XLSForm de markdown a HTML
// =============================================================================
// XLSForm soporta markdown en `label`, `hint`, `constraint_message` y
// `required_message`. Las herramientas de campo (Kobo Collect, ODK
// Collect, Enketo) renderizan **bold**, *italic*, ~~strike~~,
// [text](url), y saltos de línea.
//
// Este módulo expone `renderMarkdown(input)` para uso compartido entre
// el inspector (MarkdownField), el canvas (PreviewQuestionCard) y
// cualquier vista que muestre labels al usuario.
//
// `renderMarkdownInline(input)` no envuelve el resultado en un <p>, útil
// para labels que viven dentro de un <h3> o <span>.
//
// Funciones soportadas (subset XLSForm):
//   **bold**       → <strong>bold</strong>
//   __bold__       → <strong>bold</strong>
//   *italic*       → <em>italic</em>
//   _italic_       → <em>italic</em>
//   ~~strike~~     → <s>strike</s>
//   [text](url)    → <a href="url">text</a>
//   \n             → <br>
//   \n\n           → párrafo nuevo (visualmente)
// =============================================================================

/** Escapa HTML para inyección segura — UNA pasada antes de aplicar
 *  reemplazos de markdown. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Aplica los reemplazos de markdown en orden — los más específicos
 *  primero para que no se pisen entre sí. NO envuelve en <p>. */
function applyMarkdownTokens(escaped: string): string {
  let out = escaped;

  // Links: [text](url). Hacemos esto ANTES de otros para no comer
  // los corchetes con énfasis.
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, text: string, url: string) => {
      // Whitelist simple: http(s), mailto, tel, # interna.
      const safe = /^(https?:|mailto:|tel:|#)/.test(url) ? url : "#";
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  );

  // Bold (** o __). Match no-greedy para que pares múltiples no se
  // mezclen: `**a** **b**` → dos bolds, no un mega bold.
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_\n]+?)__/g, "<strong>$1</strong>");

  // Italic (* o _). Cuidado: no hacer match con ** (ya lo procesamos)
  // ni con __ . Usamos lookbehind/lookahead manuales con grupo
  // negativo. En JS regex moderno: (?<!\*)\*([^*\n]+?)\*(?!\*).
  out = out.replace(/(?<![*])\*([^*\n]+?)\*(?![*])/g, "<em>$1</em>");
  out = out.replace(/(?<![_])_([^_\n]+?)_(?![_])/g, "<em>$1</em>");

  // Strikethrough.
  out = out.replace(/~~([^~\n]+?)~~/g, "<s>$1</s>");

  return out;
}

/** Renderiza el subset XLSForm de markdown a HTML, envolviendo en <p>.
 *  Mantiene un placeholder visible cuando el input está vacío. Pensado
 *  para previsualizaciones grandes (ej. el inspector). */
export function renderMarkdown(input: string): string {
  if (!input) {
    return '<p class="pulso-md-empty">Vista previa vacía.</p>';
  }
  const escaped = escapeHtml(input);
  const tokenized = applyMarkdownTokens(escaped);

  // Saltos de línea. \n\n → cierra párrafo y abre nuevo. \n → <br>.
  // Wrapeamos todo en un párrafo inicial.
  return (
    "<p>" +
    tokenized.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>") +
    "</p>"
  );
}

/** Variante inline: renderiza solo los tokens (bold, italic, strike,
 *  links, saltos como <br>) sin envolver en <p>. Útil para insertar
 *  dentro de un <h3> / <span> donde un párrafo bloquearía el layout. */
export function renderMarkdownInline(input: string): string {
  if (!input) return "";
  const escaped = escapeHtml(input);
  const tokenized = applyMarkdownTokens(escaped);
  return tokenized.replace(/\n/g, "<br>");
}

/** Quita los marcadores de markdown y devuelve texto plano. Útil para
 *  vistas densas (outline, breadcrumb, listas) donde no queremos
 *  inyectar HTML pero tampoco mostrar los `**` literales. */
export function stripMarkdown(input: string): string {
  if (!input) return "";
  let out = input;
  // Links: dejar solo el texto.
  out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Bold y strike: quitar marcadores.
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
  out = out.replace(/__([^_\n]+?)__/g, "$1");
  out = out.replace(/~~([^~\n]+?)~~/g, "$1");
  // Italic: cuidar de no comer dobles asteriscos ya procesados.
  out = out.replace(/(?<![*])\*([^*\n]+?)\*(?![*])/g, "$1");
  out = out.replace(/(?<![_])_([^_\n]+?)_(?![_])/g, "$1");
  return out;
}
