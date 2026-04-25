// =============================================================================
// inspector/MarkdownField.tsx — editor + preview de campos con markdown
// =============================================================================
// XLSForm soporta markdown en `label`, `hint`, `constraint_message` y
// `required_message`. Las herramientas de campo (Kobo Collect, ODK
// Collect, Enketo) renderizan **bold**, *italic*, ~~strike~~,
// [text](url), y saltos de línea.
//
// Este componente reemplaza al `<textarea>` plano cuando el campo
// admite markdown. Provee:
//
//   · Toolbar con botones para insertar formato (B, I, S, link).
//   · Toggle "Editar / Vista previa" para ver cómo se renderizará.
//   · Renderizado de subset de markdown sin dependencias externas
//     (no bajamos `marked` o `react-markdown` — bundle).
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

import { useRef, useState } from "react";
import { Bold, Italic, Strikethrough, Link as LinkIcon, Eye, Pencil } from "lucide-react";

export type MarkdownFieldProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  /** Si true, el toolbar muestra menos botones (espacio reducido). */
  compact?: boolean;
};

export function MarkdownField({
  value,
  onChange,
  placeholder,
  rows = 3,
  compact = false,
}: MarkdownFieldProps) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  /** Aplica un wrap (`prefix...suffix`) al texto seleccionado. Si no
   *  hay selección, inserta los dos tokens y deja el cursor entre
   *  ellos para que el usuario tipee. */
  const wrapSelection = (prefix: string, suffix: string = prefix) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const sel = value.slice(start, end);
    const after = value.slice(end);
    const next = `${before}${prefix}${sel}${suffix}${after}`;
    onChange(next);
    // Reposicionar cursor: si había selección, dejarla envuelta;
    // si no, posicionar entre prefix y suffix.
    requestAnimationFrame(() => {
      const pos = sel
        ? start + prefix.length + sel.length + suffix.length
        : start + prefix.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const insertLink = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end) || "texto";
    const url = window.prompt("URL del enlace:", "https://");
    if (!url) return;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const next = `${before}[${sel}](${url})${after}`;
    onChange(next);
  };

  return (
    <div className="pulso-md-field">
      <div className="pulso-md-toolbar">
        <div className="pulso-md-toolbar-actions">
          <button
            type="button"
            className="pulso-md-toolbar-btn"
            onClick={() => wrapSelection("**")}
            title="Negrita (Cmd+B)"
            aria-label="Negrita"
            disabled={tab === "preview"}
          >
            <Bold size={13} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="pulso-md-toolbar-btn"
            onClick={() => wrapSelection("*")}
            title="Itálica (Cmd+I)"
            aria-label="Itálica"
            disabled={tab === "preview"}
          >
            <Italic size={13} />
          </button>
          {!compact && (
            <button
              type="button"
              className="pulso-md-toolbar-btn"
              onClick={() => wrapSelection("~~")}
              title="Tachado"
              aria-label="Tachado"
              disabled={tab === "preview"}
            >
              <Strikethrough size={13} />
            </button>
          )}
          <button
            type="button"
            className="pulso-md-toolbar-btn"
            onClick={insertLink}
            title="Insertar enlace"
            aria-label="Insertar enlace"
            disabled={tab === "preview"}
          >
            <LinkIcon size={13} />
          </button>
        </div>
        <div className="pulso-md-toolbar-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "edit"}
            className={tab === "edit" ? "is-on" : ""}
            onClick={() => setTab("edit")}
            title="Editar"
          >
            <Pencil size={11} /> Editar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            className={tab === "preview" ? "is-on" : ""}
            onClick={() => setTab("preview")}
            title="Vista previa"
          >
            <Eye size={11} /> Vista previa
          </button>
        </div>
      </div>

      {tab === "edit" ? (
        <textarea
          ref={textareaRef}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "b") {
              e.preventDefault();
              wrapSelection("**");
            } else if ((e.metaKey || e.ctrlKey) && e.key === "i") {
              e.preventDefault();
              wrapSelection("*");
            }
          }}
        />
      ) : (
        <div
          className="pulso-md-preview"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(value || ""),
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// renderMarkdown — parser propio del subset XLSForm. Sin deps.
// -----------------------------------------------------------------------------

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

/** Renderiza el subset XLSForm de markdown a HTML. Orden importa: los
 *  reemplazos más específicos primero para que no se pisen entre sí. */
export function renderMarkdown(input: string): string {
  if (!input) {
    return '<p class="pulso-md-empty">Vista previa vacía.</p>';
  }
  let out = escapeHtml(input);

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

  // Saltos de línea. \n\n → cierra párrafo y abre nuevo. \n → <br>.
  // Wrapeamos todo en un párrafo inicial.
  out = "<p>" + out.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";

  return out;
}
