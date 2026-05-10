// =============================================================================
// helpers/RichInline.tsx — editor inline tipo Notion para campos con markdown
// =============================================================================
// Render WYSIWYG: el usuario ve la negrita / itálica / link como formato real
// (no `**` literales) y puede editarlo en el lugar. Cmd+B / Cmd+I envuelven
// la selección. Al perder foco, serializa de vuelta a markdown y dispara
// `onChange`.
//
// El componente acepta `value` como markdown (subset XLSForm) y siempre lo
// renderiza con formato visible. Es la pieza central del lienzo único de F1
// (canvas/FormCanvas.tsx, EditableQuestionCard, EditableChoiceList).
//
// Para el "modo crudo" (vista Hojas, edición avanzada) se sigue usando
// `MarkdownField` (que tiene textarea + toolbar + toggle).
// =============================================================================

import { useCallback, useEffect, useRef } from "react";
import { renderMarkdownInline } from "./markdown";

export type RichInlineProps = {
  /** Texto en markdown (subset XLSForm). */
  value: string;
  /** Disparado al perder foco con el markdown serializado. */
  onChange: (next: string) => void;
  placeholder?: string;
  /** Si true, no permite edición (solo display). */
  readOnly?: boolean;
  /** Disparado cuando el usuario presiona Enter sin Shift. Útil para
   *  flujo "Enter crea la siguiente pregunta" tipo Notion. Si retorna
   *  true, el componente NO inserta el salto de línea. */
  onSubmit?: () => boolean | void;
  /** Disparado cuando el usuario presiona Backspace con el campo vacío.
   *  Útil para "borrar la pregunta y enfocar la anterior". */
  onEmptyBackspace?: () => void;
  /** Tag para envolver el editor. Por defecto `div`; pasa `"h3"` o
   *  `"span"` cuando se monta dentro de headings. */
  as?: "div" | "h3" | "h2" | "p" | "span";
  /** Clase CSS extra. */
  className?: string;
  /** Estilo inline extra. */
  style?: React.CSSProperties;
  /** Si true, fuerza single-line: Enter NO inserta salto, solo dispara
   *  `onSubmit` (si está). Útil para labels de pregunta y de opción. */
  singleLine?: boolean;
  /** Si true, autoenfoca al montar. */
  autoFocus?: boolean;
  /** Aria-label para accesibilidad. */
  ariaLabel?: string;
};

export function RichInline({
  value,
  onChange,
  placeholder,
  readOnly,
  onSubmit,
  onEmptyBackspace,
  as = "div",
  className,
  style,
  singleLine,
  autoFocus,
  ariaLabel,
}: RichInlineProps) {
  const ref = useRef<HTMLElement | null>(null);
  // Guardamos el último valor que pintamos para no re-pintar (y romper el
  // cursor del usuario) cuando React re-renderiza con el mismo `value`
  // que ya está en el DOM.
  const lastPaintedRef = useRef<string>(value);

  // Sincronizar el HTML cuando `value` cambia desde fuera (undo/redo,
  // edición de otra fila que comparte choice, etc).
  useEffect(() => {
    if (!ref.current) return;
    if (lastPaintedRef.current === value) return;
    // Solo repintar si el contenido actual del DOM difiere del nuevo
    // valor — evitamos pisar el cursor del usuario mientras tipea.
    const currentMarkdown = htmlToMarkdown(ref.current.innerHTML);
    if (normalizeMd(currentMarkdown) === normalizeMd(value)) return;
    ref.current.innerHTML = renderMarkdownInline(value);
    lastPaintedRef.current = value;
  }, [value]);

  // Pintar el contenido inicial al montar.
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = renderMarkdownInline(value);
    lastPaintedRef.current = value;
    if (autoFocus && !readOnly) {
      ref.current.focus();
      // Mover el cursor al final del contenido.
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    // Solo en mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback(() => {
    if (!ref.current) return;
    const next = htmlToMarkdown(ref.current.innerHTML);
    lastPaintedRef.current = next;
    if (next !== value) onChange(next);
  }, [onChange, value]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      // Cmd/Ctrl+B → bold
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        document.execCommand("bold");
        return;
      }
      // Cmd/Ctrl+I → italic
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        document.execCommand("italic");
        return;
      }
      // Backspace en campo vacío → onEmptyBackspace
      if (
        e.key === "Backspace" &&
        onEmptyBackspace &&
        !ref.current?.textContent?.trim()
      ) {
        e.preventDefault();
        onEmptyBackspace();
        return;
      }
      // Enter
      if (e.key === "Enter" && !e.shiftKey) {
        if (singleLine || onSubmit) {
          e.preventDefault();
          // Forzar flush antes para que el handler tenga el valor actual.
          flush();
          const handled = onSubmit?.();
          if (handled === true || singleLine) return;
        }
      }
    },
    [flush, onEmptyBackspace, onSubmit, singleLine],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLElement>) => {
      // Pegar como texto plano para evitar que entren estilos / clases
      // / fonts del origen (Word, web, etc).
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      // singleLine: colapsar saltos.
      const cleaned = singleLine ? text.replace(/[\r\n]+/g, " ") : text;
      document.execCommand("insertText", false, cleaned);
    },
    [singleLine],
  );

  // Render polymorphic — JSX.IntrinsicElements no propaga tipos finos a
  // los handlers (HTMLElement vs SVGElement). Casteamos al tipo any para
  // que TS no exija exactamente el shape del child element específico.
  const Tag = as as React.ElementType;

  return (
    <Tag
      ref={ref as React.RefObject<HTMLElement>}
      role="textbox"
      aria-multiline={!singleLine}
      aria-label={ariaLabel}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      data-placeholder={placeholder || ""}
      data-empty={!value || value.length === 0 ? "true" : "false"}
      className={`pulso-rich-inline ${className || ""}`}
      style={style}
      onKeyDown={onKeyDown as unknown as React.KeyboardEventHandler}
      onPaste={onPaste as unknown as React.ClipboardEventHandler}
      onBlur={flush}
      // Para que onChange dispare en cada caracter podríamos llamar flush
      // en `onInput`, pero eso explota el undo-stack. Mejor flush en blur.
    />
  );
}

// -----------------------------------------------------------------------------
// htmlToMarkdown — serializa el HTML del contenteditable de vuelta a markdown
// -----------------------------------------------------------------------------

/** Normaliza un string de markdown para comparaciones (colapsa whitespace
 *  no significativo, mismo tipo de markers). */
function normalizeMd(s: string): string {
  return s.replace(/ /g, " ").trim();
}

/** Recorre el árbol DOM y serializa a markdown subset XLSForm. */
function htmlToMarkdown(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return serializeNode(tmp).replace(/ /g, " ");
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  // Hijos primero — la mayoría de tags solo envuelve.
  const inner = Array.from(el.childNodes).map(serializeNode).join("");

  switch (tag) {
    case "strong":
    case "b":
      return inner ? `**${inner}**` : "";
    case "em":
    case "i":
      return inner ? `*${inner}*` : "";
    case "s":
    case "strike":
    case "del":
      return inner ? `~~${inner}~~` : "";
    case "a": {
      const href = el.getAttribute("href") || "";
      return inner && href ? `[${inner}](${href})` : inner;
    }
    case "br":
      return "\n";
    case "p":
    case "div":
      // Bloque: agregar salto al final (excepto si ya termina con uno).
      return inner.endsWith("\n") ? inner : `${inner}\n`;
    default:
      return inner;
  }
}
