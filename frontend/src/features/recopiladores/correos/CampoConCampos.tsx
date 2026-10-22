// Un texto del inspector donde los campos se ven como en el lienzo: un chip
// «Nombre», no la llave del motor (#4 del QA e10), y la negrita y la cursiva
// como formato, no como asteriscos (#1 del re-QA e10-2).
//
// Es el mismo DOM cerrado que el editor en línea (serializarTexto.ts): texto,
// negrita, cursiva, enlaces donde la propiedad los admite, saltos de línea
// donde es multilínea y chips de campo. Cada cambio vuelve como texto del
// contrato; el cursor se informa en ese texto para que «Campos de cada
// persona» inserte el campo donde está. Un valor que cambia por fuera
// (deshacer, un campo insertado desde la columna) se repinta, con el cursor
// donde estaba si el campo tiene el foco.
//
// Una llave escrita se vuelve chip sin mover el cursor de donde se escribía
// (N4, volcadoDelCampo.ts). Un campo que la campaña no declara sale en tono de
// error con su aviso al lado (N5, camposDeclarados.ts).

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ClipboardEvent, type CSSProperties, type KeyboardEvent } from "react";

import type { MailProblem } from "../../../api/materialMail";
import { Bold, Italic } from "../../../vendor/lucide-react";
import { rotuloDeAtajo } from "./atajosDelEditor";
import { avisoDeCampoNoDeclarado } from "./camposDeclarados";
import { PATRON_CAMPO, desplazamientoDelCursor, htmlDelTexto, puntoDelDesplazamiento, textoDelDom, textoDelPegado, type OpcionesDeTexto } from "./serializarTexto";
import { cursorEnElContrato, procesarEntrada } from "./volcadoDelCampo";
import "./correosCampos.css";

type Props = {
  label: string;
  valor: string;
  opciones: Pick<OpcionesDeTexto, "rotuloDeCampo" | "ayudaDeCampo" | "campoValido">;
  onCambio: (valor: string) => void;
  /** Dónde está el cursor, en el texto del contrato. */
  onCursor?: (cursor: number | null) => void;
  ayuda?: string;
  problemas?: readonly MailProblem[];
  /** Lleva a Personas, donde se declaran los campos. */
  onIrAPersonas?: () => void;
  /** Enter parte el renglón (párrafo, pie, listas). Si no, Enter no hace nada. */
  multilinea?: boolean;
  /** La propiedad admite `[texto](url)`: un enlace guardado se conserva y se ve como enlace. */
  enlaces?: boolean;
  /** Alto mínimo, en renglones, de un campo multilínea. */
  filas?: number;
  /**
   * Cómo guarda el bloque lo escrito (una lista pierde los renglones vacíos y
   * los espacios de los bordes). Si el valor que vuelve es lo escrito ya
   * guardado, no se repinta: el cursor y el espacio recién tecleado se quedan.
   */
  normalizar?: (texto: string) => string;
  /**
   * Sin formato (la dirección de un enlace): ni negrita ni cursiva, un
   * asterisco es un asterisco y la letra es de máquina. Los campos siguen
   * siendo chips.
   */
  formato?: boolean;
};

/** Cuántos caracteres del contrato hay antes del cursor. */
function cursorEnElTexto(raiz: HTMLElement, opciones: OpcionesDeTexto): number | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!raiz.contains(r.startContainer)) return null;
  const antes = document.createRange();
  antes.selectNodeContents(raiz);
  antes.setEnd(r.startContainer, r.startOffset);
  const caja = document.createElement("div");
  caja.appendChild(antes.cloneContents());
  return cursorEnElContrato(textoDelDom(caja, opciones), textoDelDom(raiz, opciones));
}

/** Las claves del texto que la campaña no declara, sin repetir. */
function clavesFuera(texto: string, campoValido: OpcionesDeTexto["campoValido"]): string[] {
  if (!campoValido) return [];
  const out: string[] = [];
  for (const m of texto.matchAll(new RegExp(PATRON_CAMPO.source, "g"))) {
    if (!campoValido(m[1]) && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

function ponerCursor(raiz: HTMLElement, desplazamiento: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const { nodo, offset } = puntoDelDesplazamiento(raiz, desplazamiento);
  const r = document.createRange();
  r.setStart(nodo, offset);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

/** Formatos que el contrato no tiene: no entran ni por el menú del sistema. */
const ENTRADAS_BLOQUEADAS = new Set([
  "formatUnderline",
  "formatStrikeThrough",
  "formatSuperscript",
  "formatSubscript",
  "formatFontColor",
  "formatBackColor",
  "formatFontName",
  "formatJustifyCenter",
  "formatJustifyRight",
  "formatJustifyFull",
  "formatIndent",
  "formatOutdent",
  "insertOrderedList",
  "insertUnorderedList",
  "insertHorizontalRule",
  "insertFromDrop",
]);

export function CampoConCampos({
  label,
  valor,
  opciones,
  onCambio,
  onCursor,
  ayuda,
  problemas,
  onIrAPersonas,
  multilinea = false,
  enlaces = false,
  filas = 4,
  normalizar,
  formato: conFormato = true,
}: Props) {
  const id = useId();
  const editable = useRef<HTMLDivElement | null>(null);
  const ultimo = useRef<string | null>(null);
  const [formato, setFormato] = useState({ negrita: false, cursiva: false });
  const opcionesRef = useRef<OpcionesDeTexto>({ enlaces, multilinea, sinMarcas: !conFormato, ...opciones });
  opcionesRef.current = { enlaces, multilinea, sinMarcas: !conFormato, ...opciones };
  const normalizarRef = useRef(normalizar);
  normalizarRef.current = normalizar;
  const fuera = clavesFuera(valor, opciones.campoValido);
  // El aviso propio dice qué campo falta; el detalle del backend lo repetiría con la llave.
  const propios = fuera.length ? (problemas ?? []).filter((p) => p.code !== "unknown_field") : problemas ?? [];
  const conError = Boolean(propios.length || fuera.length);

  const pintar = useCallback((texto: string) => {
    const el = editable.current;
    if (!el) return;
    const sel = typeof window === "undefined" ? null : window.getSelection();
    const r = sel?.rangeCount ? sel.getRangeAt(0) : null;
    const cursor = r && document.activeElement === el ? desplazamientoDelCursor(el, r.startContainer, r.startOffset) : null;
    el.innerHTML = htmlDelTexto(texto, opcionesRef.current);
    ultimo.current = texto;
    if (cursor !== null) ponerCursor(el, cursor);
  }, []);

  useLayoutEffect(() => {
    const previo = ultimo.current;
    if (valor === previo) return;
    // Lo escrito, ya guardado por el bloque: el DOM manda (no se pierde el espacio recién tecleado).
    if (previo !== null && normalizarRef.current?.(previo) === valor) return;
    pintar(valor);
  }, [pintar, valor]);

  // Declarar o quitar un campo en Personas cambia el tono de sus chips: si un
  // chip quedó con el tono viejo, se repinta.
  const campoValido = opciones.campoValido;
  useLayoutEffect(() => {
    const el = editable.current;
    if (!el || !campoValido || ultimo.current === null) return;
    const desfasado = Array.from(el.querySelectorAll("[data-campo]"))
      .some((c) => c.classList.contains("is-invalido") === campoValido(c.getAttribute("data-campo") ?? ""));
    if (desfasado) pintar(ultimo.current);
  });

  const leerFormato = () => {
    if (typeof document === "undefined") return;
    const negrita = document.queryCommandState("bold");
    const cursiva = document.queryCommandState("italic");
    setFormato((f) => (f.negrita === negrita && f.cursiva === cursiva ? f : { negrita, cursiva }));
  };

  const informar = () => {
    const el = editable.current;
    if (!el) return;
    onCursor?.(cursorEnElTexto(el, opcionesRef.current));
    if (document.activeElement === el) leerFormato();
  };

  const volcar = () => {
    const el = editable.current;
    if (!el) return;
    const sel = window.getSelection();
    const r = sel?.rangeCount ? sel.getRangeAt(0) : null;
    const cursor = r && el.contains(r.startContainer) ? { nodo: r.startContainer, offset: r.startOffset } : null;
    const out = procesarEntrada({
      raiz: el,
      cursor,
      opciones: opcionesRef.current,
      ultimo: ultimo.current,
      onCambio: (texto) => { ultimo.current = texto; onCambio(texto); },
    });
    // Una llave escrita a mano (`{{nombre}}`) se vuelve chip al instante, y el
    // cursor queda justo después de lo escrito. Lo mismo con lo que deja un
    // pegado fuera del DOM permitido.
    if (out.repintar) {
      el.innerHTML = out.repintar.html;
      ultimo.current = out.texto;
      if (out.repintar.cursor !== null) ponerCursor(el, out.repintar.cursor);
    }
    informar();
  };

  const alternar = (comando: "bold" | "italic") => {
    const el = editable.current;
    if (!el) return;
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    document.execCommand(comando);
    volcar();
  };

  const alTeclear = (event: KeyboardEvent<HTMLDivElement>) => {
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (mod && !event.altKey && (key === "b" || key === "i")) {
      event.preventDefault();
      if (conFormato) alternar(key === "b" ? "bold" : "italic");
      return;
    }
    // Subrayado no existe en el correo.
    if (mod && key === "u") {
      event.preventDefault();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      // Multilínea: Enter parte el renglón; si no, el texto es de una sola línea.
      if (multilinea) {
        document.execCommand("insertLineBreak");
        volcar();
      }
    }
  };

  // Lo pegado entra como texto plano.
  const alPegar = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const texto = textoDelPegado({ html: event.clipboardData.getData("text/html"), texto: event.clipboardData.getData("text/plain") }, multilinea);
    if (texto) document.execCommand("insertText", false, texto);
    volcar();
  };

  useEffect(() => {
    const el = editable.current;
    if (!el) return;
    const alEntrar = (event: InputEvent) => {
      if (ENTRADAS_BLOQUEADAS.has(event.inputType)) event.preventDefault();
      if (opcionesRef.current.sinMarcas && (event.inputType === "formatBold" || event.inputType === "formatItalic")) event.preventDefault();
      if (event.inputType === "insertParagraph") event.preventDefault();
      if (event.inputType === "insertLineBreak" && !opcionesRef.current.multilinea) event.preventDefault();
    };
    el.addEventListener("beforeinput", alEntrar);
    return () => el.removeEventListener("beforeinput", alEntrar);
  }, []);

  const estilo = multilinea ? ({ "--rec-campo-filas": String(filas) } as CSSProperties) : undefined;

  return (
    <div className="rec-mail-campo-texto">
      <span className="rec-mail-campo-rotulo">
        <span id={`${id}-rotulo`}>{label}</span>
        {/* Con el ratón, B e I junto al rótulo; con el teclado, ⌘B / ⌘I (o Ctrl). */}
        {conFormato ? <span className="rec-mail-campo-formato">
          <button
            type="button"
            tabIndex={-1}
            className={`rec-mail-campo-formato-btn${formato.negrita ? " is-on" : ""}`}
            aria-pressed={formato.negrita}
            aria-label="Negrita"
            title={rotuloDeAtajo("Negrita", "B")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => alternar("bold")}
          >
            <Bold size={13} aria-hidden />
          </button>
          <button
            type="button"
            tabIndex={-1}
            className={`rec-mail-campo-formato-btn${formato.cursiva ? " is-on" : ""}`}
            aria-pressed={formato.cursiva}
            aria-label="Cursiva"
            title={rotuloDeAtajo("Cursiva", "I")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => alternar("italic")}
          >
            <Italic size={13} aria-hidden />
          </button>
        </span> : null}
      </span>
      <div
        ref={editable}
        role="textbox"
        aria-labelledby={`${id}-rotulo`}
        aria-multiline={multilinea || undefined}
        aria-describedby={[ayuda ? `${id}-ayuda` : "", conError ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
        aria-invalid={conError || undefined}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        className={`rec-mail-input rec-mail-input--campos${multilinea ? " is-multilinea" : ""}${conFormato ? "" : " is-mono"}${conError ? " is-error" : ""}`}
        style={estilo}
        onInput={volcar}
        onKeyDown={alTeclear}
        onKeyUp={informar}
        onMouseUp={informar}
        onFocus={informar}
        onPaste={alPegar}
      />
      {ayuda ? <span className="rec-mail-ayuda" id={`${id}-ayuda`}>{ayuda}</span> : null}
      {conError ? (
        <div id={`${id}-error`}>
          {fuera.map((key) => {
            const [antes, despues] = avisoDeCampoNoDeclarado(opciones.rotuloDeCampo?.(key) ?? key).split("Personas");
            return (
              <p key={key} className="rec-mail-campo-aviso" role="alert">
                {antes}
                {onIrAPersonas ? <button type="button" className="rec-mail-link" onClick={onIrAPersonas}>Personas</button> : "Personas"}
                {despues}
              </p>
            );
          })}
          {propios.length ? (
            <ul className="rec-mail-problemas">
              {propios.map((p, i) => <li key={`${p.path}-${i}`}>{p.detail}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
