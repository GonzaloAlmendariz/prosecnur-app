// =============================================================================
// inspector/MarkdownField.tsx — editor de texto con formato (estilo Word)
// =============================================================================
// Para el usuario, este editor se comporta como Word: si pone una palabra
// en negrita, se ve negrita. Nunca ve markdown crudo (`**negrita**`). El
// markdown vive bajo el capó: se serializa al guardar para que el
// archivo XLSForm exportado lo entienda KoBo / Enketo / Collect.
//
// Implementación: contenteditable con toolbar (B / I / S / link). Los
// botones aplican `document.execCommand` sobre la selección activa del
// contenteditable, igual que un editor rich-text clásico. El parser
// markdown ↔ HTML vive en `helpers/markdown.ts`.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Strikethrough, Link as LinkIcon, Type, Palette } from "lucide-react";
import { renderMarkdownInline, sanitizeColor } from "../helpers/markdown";

/** Paleta de colores que Enketo/KoBo renderiza en labels. El último
 *  ("inherit") quita el color. */
const MD_COLOR_SWATCHES: Array<{ value: string; label: string }> = [
  { value: "#e11d48", label: "Rojo" },
  { value: "#ea580c", label: "Naranja" },
  { value: "#15803d", label: "Verde" },
  { value: "#2563eb", label: "Azul" },
  { value: "#7c3aed", label: "Morado" },
  { value: "inherit", label: "Sin color" },
];

export type MarkdownFieldProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Ignorado — se mantiene la prop por compatibilidad con call sites. */
  rows?: number;
  /** Si true, la toolbar muestra menos botones (omite tachado). */
  compact?: boolean;
};

export function MarkdownField({
  value,
  onChange,
  placeholder,
  compact = false,
}: MarkdownFieldProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  // Último valor pintado en el DOM — usado para evitar repintar mientras
  // el usuario tipea (lo que destruye el cursor).
  const lastPaintedRef = useRef<string>(value);
  const [colorOpen, setColorOpen] = useState(false);

  // Pintar el contenido inicial al montar.
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = renderMarkdownInline(value);
    lastPaintedRef.current = value;
    // Solo en mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronizar cuando `value` cambia desde fuera (undo/redo, edición de
  // otra fila que comparte choice). NO repintar si el contenido del DOM
  // ya equivale al nuevo valor — eso pisaría el cursor del usuario.
  useEffect(() => {
    if (!editorRef.current) return;
    if (lastPaintedRef.current === value) return;
    const currentMarkdown = htmlToMarkdown(editorRef.current.innerHTML);
    if (normalizeMd(currentMarkdown) === normalizeMd(value)) return;
    editorRef.current.innerHTML = renderMarkdownInline(value);
    lastPaintedRef.current = value;
  }, [value]);

  const flush = () => {
    if (!editorRef.current) return;
    const next = htmlToMarkdown(editorRef.current.innerHTML);
    lastPaintedRef.current = next;
    if (next !== value) onChange(next);
  };

  /** Aplica un comando del execCommand sin perder el foco del editor.
   *  El handler debe usarse en `onMouseDown` (no `onClick`) y prevenir
   *  default — así no roba el foco al contenteditable. */
  const exec = (command: string, val?: string) => {
    document.execCommand(command, false, val);
    // Disparar flush diferido — execCommand muta el DOM síncronamente
    // pero el navegador puede ajustar selección después.
    requestAnimationFrame(flush);
  };

  const insertLink = () => {
    const url = window.prompt("URL del enlace:", "https://");
    if (!url) return;
    // execCommand("createLink") usa la selección actual; si no hay,
    // inserta el href como texto. Esto está bien para el caso simple.
    exec("createLink", url);
  };

  /** Aplica color a la selección. "inherit" quita el color (removeFormat
   *  no borra otros estilos como negrita porque ejecutamos foreColor a
   *  color heredado). Usa styleWithCSS para que el navegador emita
   *  <span style="color"> en lugar de <font>. */
  const applyColor = (color: string) => {
    document.execCommand("styleWithCSS", false, "true");
    if (color === "inherit") {
      // Reaplica el color del contenedor → efectivamente lo quita.
      document.execCommand("foreColor", false, "inherit");
    } else {
      document.execCommand("foreColor", false, sanitizeColor(color));
    }
    setColorOpen(false);
    requestAnimationFrame(flush);
  };

  /** Convierte el bloque actual en encabezado (`#### …`). Si ya lo es,
   *  formatBlock lo mantiene; volver a texto normal se hace re-aplicando
   *  párrafo — para simplicidad, este botón solo promueve a encabezado. */
  const applyHeading = () => exec("formatBlock", "h4");

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      exec("bold");
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      exec("italic");
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  // Botones del toolbar usan onMouseDown + preventDefault para conservar
  // la selección del contenteditable. Si usaran onClick, el blur ya
  // habría colapsado la selección al momento de ejecutar el comando.
  const ToolbarButton = ({
    onPress,
    title,
    ariaLabel,
    abrePopover,
    abierto,
    children,
  }: {
    onPress: () => void;
    title: string;
    ariaLabel: string;
    /** Declara que el botón despliega una superficie, no que ejecuta un comando. */
    abrePopover?: boolean;
    abierto?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      className="pulso-md-toolbar-btn"
      onMouseDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      title={title}
      aria-label={ariaLabel}
      aria-haspopup={abrePopover ? "menu" : undefined}
      aria-expanded={abrePopover ? Boolean(abierto) : undefined}
    >
      {children}
    </button>
  );

  return (
    <div className="pulso-md-field">
      <div className="pulso-md-toolbar">
        <div className="pulso-md-toolbar-actions">
          <ToolbarButton
            onPress={() => exec("bold")}
            title="Negrita (Cmd+B)"
            ariaLabel="Negrita"
          >
            <Bold size={13} strokeWidth={2.5} />
          </ToolbarButton>
          <ToolbarButton
            onPress={() => exec("italic")}
            title="Itálica (Cmd+I)"
            ariaLabel="Itálica"
          >
            <Italic size={13} />
          </ToolbarButton>
          {!compact && (
            <ToolbarButton
              onPress={() => exec("strikeThrough")}
              title="Tachado"
              ariaLabel="Tachado"
            >
              <Strikethrough size={13} />
            </ToolbarButton>
          )}
          {!compact && (
            <ToolbarButton
              onPress={applyHeading}
              title="Encabezado (se ve grande en KoBo)"
              ariaLabel="Encabezado"
            >
              <Type size={13} />
            </ToolbarButton>
          )}
          <div className="pulso-md-color">
            <ToolbarButton
              onPress={() => setColorOpen((v) => !v)}
              title="Color de texto"
              ariaLabel="Color de texto"
              abrePopover
              abierto={colorOpen}
            >
              <Palette size={13} />
            </ToolbarButton>
            {colorOpen && (
              <div className="pulso-md-color-pop" role="menu" aria-label="Colores">
                {MD_COLOR_SWATCHES.map((sw) => (
                  <button
                    key={sw.value}
                    type="button"
                    className="pulso-md-color-swatch"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyColor(sw.value);
                    }}
                    title={sw.label}
                    aria-label={sw.label}
                    data-clear={sw.value === "inherit" ? "true" : undefined}
                    style={sw.value === "inherit" ? undefined : { background: sw.value }}
                  />
                ))}
              </div>
            )}
          </div>
          <ToolbarButton
            onPress={insertLink}
            title="Insertar enlace"
            ariaLabel="Insertar enlace"
          >
            <LinkIcon size={13} />
          </ToolbarButton>
        </div>
      </div>

      <div
        ref={editorRef}
        className="pulso-md-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder || ""}
        data-empty={!value || value.length === 0 ? "true" : "false"}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={flush}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// htmlToMarkdown — serializa el HTML del contenteditable a markdown.
// Idéntico al de RichInline pero exportado localmente para no acoplar
// los dos componentes innecesariamente.
// -----------------------------------------------------------------------------

function normalizeMd(s: string): string {
  return s.replace(/ /g, " ").trim();
}

function htmlToMarkdown(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return serializeNode(tmp).replace(/ /g, " ");
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
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
    // Encabezado: `formatBlock <h4>` produce <h1>..<h6>; el re-pintado
    // usa <span class="pulso-md-h4">. Ambos serializan a `#### …`.
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return inner ? `#### ${inner}\n` : "";
    case "span": {
      if (el.classList.contains("pulso-md-h4")) return inner ? `#### ${inner}` : "";
      const color = colorFromStyle(el.style.color);
      return color && inner ? `<span style="color:${color}">${inner}</span>` : inner;
    }
    // `foreColor` sin styleWithCSS produce <font color="…">; lo tratamos
    // como color span para que el label exportado lo lleve como HTML.
    case "font": {
      const color = colorFromStyle(el.getAttribute("color") || el.style.color);
      return color && inner ? `<span style="color:${color}">${inner}</span>` : inner;
    }
    case "br":
      return "\n";
    case "p":
    case "div":
      return inner.endsWith("\n") ? inner : `${inner}\n`;
    default:
      return inner;
  }
}

/** Normaliza un color del DOM (rgb(...) o hex o keyword) a un hex/keyword
 *  saneado. Devuelve "" si no hay color válido. */
function colorFromStyle(raw: string): string {
  const v = (raw || "").trim();
  if (!v) return "";
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(v);
  if (rgb) {
    const hex = [rgb[1], rgb[2], rgb[3]]
      .map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0"))
      .join("");
    return sanitizeColor(`#${hex}`);
  }
  const sane = sanitizeColor(v);
  return sane === "inherit" ? "" : sane;
}
