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
/** Whitelist de nombres de color CSS que aceptamos además de los hex.
 *  Enketo/KoBo renderiza cualquier color, pero saneamos para no dejar
 *  pasar valores arbitrarios dentro del atributo `style`. */
const SAFE_COLOR_KEYWORDS = new Set([
  "red", "orange", "green", "blue", "purple", "teal", "gray", "grey",
  "black", "brown", "maroon", "navy", "olive",
]);

/** Sanea un color para inyectarlo en `style="color:…"`. Devuelve un hex
 *  (#rgb / #rrggbb / #rrggbbaa) o un keyword de la whitelist; si no
 *  valida, cae a `inherit` (no rompe el atributo ni permite inyección). */
export function sanitizeColor(value: string): string {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{4}$|^#[0-9a-f]{6}$|^#[0-9a-f]{8}$/.test(v)) return v;
  if (SAFE_COLOR_KEYWORDS.has(v)) return v;
  return "inherit";
}

function applyMarkdownTokens(escaped: string): string {
  let out = escaped;

  // Encabezado: "#### texto" al inicio de línea (subset soportado por
  // Enketo/KoBo). Un solo nivel para mantenerlo simple; el texto del
  // encabezado sigue procesándose (negrita/itálica) porque queda en $1.
  out = out.replace(/^####[ \t]+(.+)$/gm, '<span class="pulso-md-h4">$1</span>');

  // Color: el valor guardado contiene <span style="color:X">…</span>
  // literal (HTML que Enketo/KoBo sí renderiza en labels). Tras el
  // escape quedó como `&lt;span style=&quot;color:X&quot;&gt;`; lo
  // reconstruimos SOLO para ese patrón exacto y con el color saneado —
  // cualquier otro HTML sigue escapado.
  out = out.replace(
    /&lt;span style=&quot;color:\s*([^&;"]+?)\s*&quot;&gt;([\s\S]*?)&lt;\/span&gt;/g,
    (_m, color: string, inner: string) => `<span style="color:${sanitizeColor(color)}">${inner}</span>`,
  );

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
  // Encabezado: quitar el prefijo "#### ".
  out = out.replace(/^####[ \t]+/gm, "");
  // Color: dejar solo el texto interno del <span style="color:…">.
  out = out.replace(/<span style="color:[^"]*">([\s\S]*?)<\/span>/gi, "$1");
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
