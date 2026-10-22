// Un texto de una línea del inspector donde los campos se ven como en el
// lienzo: un chip «Nombre», no la llave del motor (#4 del QA e10).
//
// Es el mismo DOM cerrado que el editor en línea (serializarTexto.ts): texto,
// negrita, cursiva y chips de campo. Cada cambio vuelve como texto del
// contrato; el cursor se informa en ese texto para que «Campos de cada
// persona» inserte el campo donde está. Un valor que cambia por fuera
// (deshacer, un campo insertado desde la columna) se repinta.
//
// Una llave escrita se vuelve chip sin mover el cursor de donde se escribía
// (N4, volcadoDelCampo.ts). Un campo que la campaña no declara sale en tono de
// error con su aviso al lado (N5, camposDeclarados.ts).

import { useCallback, useEffect, useId, useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

import type { MailProblem } from "../../../api/materialMail";
import { avisoDeCampoNoDeclarado } from "./camposDeclarados";
import { PATRON_CAMPO, htmlDelTexto, puntoDelDesplazamiento, textoDelDom, textoDelPegado, type OpcionesDeTexto } from "./serializarTexto";
import { procesarEntrada } from "./volcadoDelCampo";
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

export function CampoConCampos({ label, valor, opciones, onCambio, onCursor, ayuda, problemas, onIrAPersonas }: Props) {
  const id = useId();
  const editable = useRef<HTMLDivElement | null>(null);
  const ultimo = useRef<string | null>(null);
  const opcionesRef = useRef<OpcionesDeTexto>({ ...OPCIONES_BASE, ...opciones });
  opcionesRef.current = { ...OPCIONES_BASE, ...opciones };
  const fuera = clavesFuera(valor, opciones.campoValido);
  // El aviso propio dice qué campo falta; el detalle del backend lo repetiría con la llave.
  const propios = fuera.length ? (problemas ?? []).filter((p) => p.code !== "unknown_field") : problemas ?? [];
  const conError = Boolean(propios.length || fuera.length);

  const pintar = useCallback((texto: string) => {
    const el = editable.current;
    if (!el) return;
    el.innerHTML = htmlDelTexto(texto, opcionesRef.current);
    ultimo.current = texto;
  }, []);

  useLayoutEffect(() => {
    if (valor !== ultimo.current) pintar(valor);
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

  const informar = () => {
    const el = editable.current;
    if (el) onCursor?.(cursorEnElTexto(el, opcionesRef.current));
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
    // cursor queda justo después de lo escrito.
    if (out.repintar) {
      el.innerHTML = out.repintar.html;
      ultimo.current = out.texto;
      if (out.repintar.cursor !== null) ponerCursor(el, out.repintar.cursor);
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
