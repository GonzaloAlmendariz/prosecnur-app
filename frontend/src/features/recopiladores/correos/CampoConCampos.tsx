// Un texto de una línea del inspector donde los campos se ven como en el
// lienzo: un chip «Nombre», no la llave del motor (#4 del QA e10).
//
// Es el mismo DOM cerrado que el editor en línea (serializarTexto.ts): texto,
// negrita, cursiva y chips de campo. Cada cambio vuelve como texto del
// contrato; el cursor se informa en ese texto para que «Campos de cada
// persona» inserte el campo donde está. Un valor que cambia por fuera
// (deshacer, un campo insertado desde la columna) se repinta.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

import type { MailProblem } from "../../../api/materialMail";
import { htmlDelTexto, textoDelDom, textoDelPegado, type OpcionesDeTexto } from "./serializarTexto";

type Props = {
  label: string;
  valor: string;
  opciones: Pick<OpcionesDeTexto, "rotuloDeCampo" | "ayudaDeCampo">;
  onCambio: (valor: string) => void;
  /** Dónde está el cursor, en el texto del contrato. */
  onCursor?: (cursor: number | null) => void;
  ayuda?: string;
  problemas?: readonly MailProblem[];
};

const OPCIONES_BASE = { enlaces: false, multilinea: false } as const;

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
  return textoDelDom(caja, opciones).length;
}

export function CampoConCampos({ label, valor, opciones, onCambio, onCursor, ayuda, problemas }: Props) {
  const id = useId();
  const editable = useRef<HTMLDivElement | null>(null);
  const ultimo = useRef<string | null>(null);
  const opcionesRef = useRef<OpcionesDeTexto>({ ...OPCIONES_BASE, ...opciones });
  opcionesRef.current = { ...OPCIONES_BASE, ...opciones };
  const conError = Boolean(problemas?.length);

  const pintar = useCallback((texto: string) => {
    const el = editable.current;
    if (!el) return;
    el.innerHTML = htmlDelTexto(texto, opcionesRef.current);
    ultimo.current = texto;
  }, []);

  useLayoutEffect(() => {
    if (valor !== ultimo.current) pintar(valor);
  }, [pintar, valor]);

  const informar = () => {
    const el = editable.current;
    if (el) onCursor?.(cursorEnElTexto(el, opcionesRef.current));
  };

  const volcar = () => {
    const el = editable.current;
    if (!el) return;
    const texto = textoDelDom(el, opcionesRef.current);
    // Una llave escrita a mano (`{{nombre}}`) se vuelve chip al instante.
    if (/\{\{\s*[a-z][a-z0-9_]*\s*\}\}/.test(el.textContent ?? "")) pintar(texto);
    if (texto !== ultimo.current) {
      ultimo.current = texto;
      onCambio(texto);
    }
    informar();
  };

  // Una sola línea: Enter no parte el texto.
  const alTeclear = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") event.preventDefault();
  };

  // Lo pegado entra como texto plano.
  const alPegar = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const texto = textoDelPegado({ html: event.clipboardData.getData("text/html"), texto: event.clipboardData.getData("text/plain") }, false);
    document.execCommand("insertText", false, texto);
  };

  useEffect(() => {
    const el = editable.current;
    if (!el) return;
    const alEntrar = (event: InputEvent) => {
      if (event.inputType === "insertParagraph" || event.inputType === "insertLineBreak" || event.inputType === "insertFromDrop") event.preventDefault();
    };
    el.addEventListener("beforeinput", alEntrar);
    return () => el.removeEventListener("beforeinput", alEntrar);
  }, []);

  return (
    <div className="rec-mail-campo-texto">
      <span className="rec-mail-campo-rotulo" id={`${id}-rotulo`}>
        <span>{label}</span>
      </span>
      <div
        ref={editable}
        role="textbox"
        aria-labelledby={`${id}-rotulo`}
        aria-describedby={[ayuda ? `${id}-ayuda` : "", conError ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
        aria-invalid={conError || undefined}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        className={`rec-mail-input rec-mail-input--campos${conError ? " is-error" : ""}`}
        onInput={volcar}
        onKeyDown={alTeclear}
        onKeyUp={informar}
        onMouseUp={informar}
        onFocus={informar}
        onPaste={alPegar}
      />
      {ayuda ? <span className="rec-mail-ayuda" id={`${id}-ayuda`}>{ayuda}</span> : null}
      {conError ? (
        <ul className="rec-mail-problemas" id={`${id}-error`}>
          {problemas!.map((p, i) => <li key={`${p.path}-${i}`}>{p.detail}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
