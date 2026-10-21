import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { Bold, Check, CornerDownLeft, Italic, Link2, Variable } from "../../../vendor/lucide-react";
import { rotuloDeAtajo } from "./atajosDelEditor";
import type { Rect } from "./estructuraCorreo";
import { atajoDeHistorial } from "./historialCorreo";
import { MenuDeCampos, type CampoDelMenu } from "./MenuDeCampos";
import { PopoverDeEnlace } from "./PopoverDeEnlace";
import {
  desplazamientoDelCursor,
  htmlDelChip,
  htmlDelTexto,
  puntoDelDesplazamiento,
  textoDelDom,
  textoDelPegado,
  type OpcionesDeTexto,
} from "./serializarTexto";

export type MotivoDeFin = "listo" | "escape" | "fuera" | "tab";

type Props = {
  valor: string;
  opciones: OpcionesDeTexto;
  campos: readonly CampoDelMenu[];
  /** Rectángulo del texto en el espacio de la capa. */
  rect: Rect;
  /** Tipografía copiada del texto del correo (ya a escala). */
  estilo: CSSProperties;
  /** Ancho de la capa, para que los menús no se salgan de la hoja. */
  anchoDeLaCapa: number;
  etiqueta: string;
  /** ¿Es un punto de una lista? Enter crea el siguiente; Backspace en vacío lo quita. */
  esPunto: boolean;
  onCambio: (valor: string) => void;
  onTerminar: (motivo: MotivoDeFin) => void;
  onSiguientePunto?: () => void;
  onQuitarPunto?: () => void;
  onDeshacer: () => void;
  onRehacer: () => void;
};

type Menu = { x: number; y: number; rango: Range | null };
type Enlace = Menu & { url: string; texto: string; existente: HTMLElement | null };

const ANCHO_DEL_MENU = 288;
const ANCHO_DEL_ENLACE = 320;

/** Bloqueados siempre: el contrato no tiene subrayado ni color (la cursiva sí, E1n). */
const ENTRADAS_BLOQUEADAS = new Set([
  "formatUnderline",
  "formatStrikeThrough",
  "formatSuperscript",
  "formatSubscript",
  "formatFontColor",
  "formatBackColor",
  "formatFontName",
  "formatJustifyFull",
  "formatJustifyCenter",
  "formatJustifyRight",
  "formatJustifyLeft",
  "formatIndent",
  "formatOutdent",
  "insertFromDrop",
  "insertOrderedList",
  "insertUnorderedList",
  "insertHorizontalRule",
  "insertLink",
]);

function rangoActual(raiz: HTMLElement): Range | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  return raiz.contains(r.commonAncestorContainer) ? r : null;
}

function ponerRango(rango: Range): void {
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(rango);
}

function cursorAlFinal(raiz: HTMLElement): void {
  const r = document.createRange();
  r.selectNodeContents(raiz);
  r.collapse(false);
  ponerRango(r);
}

function cursorEn(raiz: HTMLElement, desplazamiento: number): void {
  const { nodo, offset } = puntoDelDesplazamiento(raiz, desplazamiento);
  const r = document.createRange();
  r.setStart(nodo, offset);
  r.collapse(true);
  ponerRango(r);
}

function enlaceDelRango(raiz: HTMLElement, rango: Range | null): HTMLElement | null {
  if (!rango) return null;
  let nodo: Node | null = rango.startContainer;
  while (nodo && nodo !== raiz) {
    if (nodo.nodeType === 1 && (nodo as Element).matches("a[data-href]")) return nodo as HTMLElement;
    nodo = nodo.parentNode;
  }
  return null;
}

/**
 * Editor en línea, restringido, sobre el texto del correo (E1g §1).
 *
 * Vive en el documento padre, encima del texto que pinta el iframe: la vista
 * previa puede seguir llegando sin tocar el cursor. Su DOM es el que permite
 * `serializarTexto` (texto, negrita, cursiva, enlaces y chips de campo) y cada
 * cambio se devuelve como texto del contrato. Se repinta sólo cuando el valor
 * cambia por fuera (deshacer, un `{{campo}}` escrito que se vuelve chip, un
 * pegado). Un asterisco escrito es texto: el formato se pone con ⌘B / ⌘I.
 */
export function EditorEnLinea({
  valor,
  opciones,
  campos,
  rect,
  estilo,
  anchoDeLaCapa,
  etiqueta,
  esPunto,
  onCambio,
  onTerminar,
  onSiguientePunto,
  onQuitarPunto,
  onDeshacer,
  onRehacer,
}: Props) {
  const caja = useRef<HTMLDivElement | null>(null);
  const editable = useRef<HTMLDivElement | null>(null);
  const ultimo = useRef(valor);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [enlace, setEnlace] = useState<Enlace | null>(null);
  const [negrita, setNegrita] = useState(false);
  const [cursiva, setCursiva] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const opcionesRef = useRef(opciones);
  opcionesRef.current = opciones;

  const pintar = useCallback((texto: string, cursor: number | "fin" | null) => {
    const el = editable.current;
    if (!el) return;
    el.innerHTML = htmlDelTexto(texto, opcionesRef.current);
    ultimo.current = texto;
    if (cursor === "fin") cursorAlFinal(el);
    else if (cursor !== null) cursorEn(el, cursor);
  }, []);

  // Al montar: el texto con formato, el foco y el cursor al final.
  useLayoutEffect(() => {
    pintar(valor, null);
    editable.current?.focus({ preventScroll: true });
    if (editable.current) cursorAlFinal(editable.current);
    // Sólo al montar: después manda el DOM mientras se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Un valor que cambió por fuera (deshacer, rehacer) se repinta conservando
  // el cursor donde se pueda.
  useEffect(() => {
    const el = editable.current;
    if (!el || valor === ultimo.current) return;
    const r = rangoActual(el);
    const cursor = r ? desplazamientoDelCursor(el, r.startContainer, r.startOffset) : null;
    pintar(valor, cursor ?? "fin");
  }, [pintar, valor]);

  const posicionDelCursor = useCallback((ancho: number): { x: number; y: number } => {
    const el = editable.current;
    const base = caja.current?.offsetParent?.getBoundingClientRect();
    const r = el ? rangoActual(el) : null;
    let punto = r?.getBoundingClientRect();
    if (!punto || (!punto.width && !punto.height && !punto.left)) punto = el?.getBoundingClientRect();
    if (!base || !punto) return { x: rect.x, y: rect.y + rect.h + 6 };
    const x = Math.max(4, Math.min(punto.left - base.left, anchoDeLaCapa - ancho - 4));
    return { x, y: punto.bottom - base.top + 6 };
  }, [anchoDeLaCapa, rect.h, rect.x, rect.y]);

  /** Vuelca el DOM al texto del contrato. Si quedó un `{{k}}` escrito o un nodo ajeno, lo pinta con formato. */
  const volcar = useCallback(() => {
    const el = editable.current;
    if (!el) return;
    const texto = textoDelDom(el, opcionesRef.current);
    // `<b>` e `<i>` (lo que deja execCommand) se leen como negrita y cursiva:
    // repintarlos perdería la selección justo después de ⌘B / ⌘I.
    const sinFormato = Array.from(el.childNodes).some((n) => n.nodeType === 3 && /\{\{\s*[a-z][a-z0-9_]*\s*\}\}/.test(n.nodeValue ?? ""))
      || el.querySelector("div,p,u,font,span:not([data-campo])") !== null;
    if (sinFormato) {
      const r = rangoActual(el);
      const cursor = r ? desplazamientoDelCursor(el, r.startContainer, r.startOffset) : null;
      pintar(texto, cursor ?? "fin");
    }
    if (texto !== ultimo.current || sinFormato) {
      ultimo.current = texto;
      onCambio(texto);
    }
  }, [onCambio, pintar]);

  const abrirMenu = useCallback(() => {
    const el = editable.current;
    if (!el) return;
    const r = rangoActual(el);
    setMenu({ ...posicionDelCursor(ANCHO_DEL_MENU), rango: r ? r.cloneRange() : null });
  }, [posicionDelCursor]);

  // `{{` abre el menú de campos y nunca queda escrito.
  const detectarLlaves = useCallback((): boolean => {
    const el = editable.current;
    const r = el ? rangoActual(el) : null;
    if (!el || !r || !r.collapsed || r.startContainer.nodeType !== 3) return false;
    const nodo = r.startContainer as Text;
    const antes = (nodo.nodeValue ?? "").slice(0, r.startOffset);
    if (!antes.endsWith("{{")) return false;
    const at = antes.length - 2;
    nodo.deleteData(at, 2);
    const c = document.createRange();
    c.setStart(nodo, at);
    c.collapse(true);
    ponerRango(c);
    abrirMenu();
    return true;
  }, [abrirMenu]);

  // `beforeinput` nativo: lo que el contrato no tiene no entra.
  useEffect(() => {
    const el = editable.current;
    if (!el) return;
    const alEntrar = (event: InputEvent) => {
      if (ENTRADAS_BLOQUEADAS.has(event.inputType)) event.preventDefault();
      if (event.inputType === "insertParagraph" && !opcionesRef.current.multilinea) event.preventDefault();
    };
    el.addEventListener("beforeinput", alEntrar);
    return () => el.removeEventListener("beforeinput", alEntrar);
  }, []);

  const insertarCampo = (key: string) => {
    const el = editable.current;
    const rango = menu?.rango;
    setMenu(null);
    if (!el) return;
    el.focus({ preventScroll: true });
    const r = rango && el.contains(rango.commonAncestorContainer) ? rango : (() => {
      const fin = document.createRange();
      fin.selectNodeContents(el);
      fin.collapse(false);
      return fin;
    })();
    r.deleteContents();
    const plantilla = document.createElement("template");
    plantilla.innerHTML = htmlDelChip(key, opcionesRef.current);
    const chip = plantilla.content.firstChild;
    if (!chip) return;
    r.insertNode(chip);
    // Sin un texto detrás, el cursor no tiene dónde quedarse después del chip.
    if (!chip.nextSibling) chip.parentNode?.appendChild(document.createTextNode("​"));
    const despues = document.createRange();
    despues.setStartAfter(chip);
    despues.collapse(true);
    ponerRango(despues);
    volcar();
  };

  const abrirEnlace = () => {
    const el = editable.current;
    if (!el) return;
    if (!opcionesRef.current.enlaces) {
      setAviso("Este texto no admite enlaces: úsalos en párrafos, recuadros, listas, firma o pie.");
      return;
    }
    const r = rangoActual(el);
    const existente = enlaceDelRango(el, r);
    setEnlace({
      ...posicionDelCursor(ANCHO_DEL_ENLACE),
      rango: r ? r.cloneRange() : null,
      url: existente?.getAttribute("data-href") ?? "",
      texto: existente ? existente.textContent ?? "" : r?.toString() ?? "",
      existente,
    });
  };

  const aplicarEnlace = (url: string, texto: string) => {
    const el = editable.current;
    const pedido = enlace;
    setEnlace(null);
    if (!el || !pedido) return;
    el.focus({ preventScroll: true });
    if (pedido.existente && el.contains(pedido.existente)) {
      pedido.existente.setAttribute("data-href", url);
      pedido.existente.setAttribute("title", url);
    } else {
      const r = pedido.rango && el.contains(pedido.rango.commonAncestorContainer) ? pedido.rango : null;
      const a = document.createElement("a");
      a.setAttribute("data-href", url);
      a.setAttribute("title", url);
      a.className = "rec-capa-enlace";
      if (r && !r.collapsed) {
        a.appendChild(r.extractContents());
        r.insertNode(a);
      } else {
        a.textContent = texto;
        if (r) r.insertNode(a);
        else el.appendChild(a);
      }
      const despues = document.createRange();
      despues.setStartAfter(a);
      despues.collapse(true);
      ponerRango(despues);
    }
    volcar();
  };

  const quitarEnlace = () => {
    const el = editable.current;
    const a = enlace?.existente;
    setEnlace(null);
    if (!el || !a || !el.contains(a)) return;
    while (a.firstChild) a.parentNode?.insertBefore(a.firstChild, a);
    a.remove();
    el.focus({ preventScroll: true });
    volcar();
  };

  const leerFormato = () => {
    setNegrita(document.queryCommandState("bold"));
    setCursiva(document.queryCommandState("italic"));
  };

  const alternar = (comando: "bold" | "italic") => {
    const el = editable.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    document.execCommand(comando);
    leerFormato();
    volcar();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    setAviso(null);
    const atajo = atajoDeHistorial(event.nativeEvent);
    if (atajo) {
      event.preventDefault();
      volcar();
      if (atajo === "deshacer") onDeshacer();
      else onRehacer();
      return;
    }
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (mod && !event.altKey && (key === "b" || key === "i")) {
      event.preventDefault();
      alternar(key === "b" ? "bold" : "italic");
      return;
    }
    if (mod && key === "k") {
      event.preventDefault();
      abrirEnlace();
      return;
    }
    // Ir al inicio o al final del texto sin que el lienzo salte entero.
    if (mod && (event.key === "ArrowUp" || event.key === "ArrowDown") && !event.shiftKey) {
      event.preventDefault();
      const el = editable.current;
      if (el) {
        if (event.key === "ArrowDown") cursorAlFinal(el);
        else cursorEn(el, 0);
      }
      return;
    }
    if (mod && key === "u") {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      volcar();
      onTerminar("escape");
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (esPunto && !event.shiftKey && onSiguientePunto) {
        volcar();
        onSiguientePunto();
      } else if (opciones.multilinea) {
        document.execCommand("insertLineBreak");
        volcar();
      } else {
        volcar();
        onTerminar("listo");
      }
      return;
    }
    if (event.key === "Backspace" && esPunto && onQuitarPunto) {
      const el = editable.current;
      const vacio = el && !(el.textContent ?? "").replace(/​/g, "").trim() && !el.querySelector("[data-campo]");
      if (vacio) {
        event.preventDefault();
        onQuitarPunto();
      }
    }
  };

  const onInput = () => {
    if (detectarLlaves()) {
      volcar();
      return;
    }
    volcar();
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const texto = textoDelPegado(
      { html: event.clipboardData.getData("text/html"), texto: event.clipboardData.getData("text/plain") },
      opciones.multilinea,
    );
    if (texto) document.execCommand("insertText", false, texto);
    volcar();
  };

  const onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    // Cambiar de ventana no termina la edición: al volver, el cursor sigue ahí.
    if (typeof document !== "undefined" && !document.hasFocus()) return;
    const destino = event.relatedTarget as Node | null;
    if (destino && caja.current?.contains(destino)) return;
    if (menu || enlace) return;
    volcar();
    onTerminar("fuera");
  };

  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const a = (event.target as HTMLElement).closest?.("a[data-href]");
    if (a && editable.current?.contains(a)) {
      event.preventDefault();
      abrirEnlace();
    }
  };

  const onSeleccion = () => {
    if (editable.current && rangoActual(editable.current)) leerFormato();
  };

  // Un clic fuera del editor (otra zona, el inspector) termina la edición,
  // aunque el foco esté en el menú de campos o en el enlace.
  const terminarRef = useRef(onTerminar);
  terminarRef.current = onTerminar;
  useEffect(() => {
    const alPulsar = (event: MouseEvent) => {
      if (caja.current && event.target instanceof Node && caja.current.contains(event.target)) return;
      setMenu(null);
      setEnlace(null);
      volcar();
      terminarRef.current("fuera");
    };
    document.addEventListener("mousedown", alPulsar, true);
    return () => document.removeEventListener("mousedown", alPulsar, true);
  }, [volcar]);

  const barraArriba = rect.y > 46;

  return (
    <div ref={caja} className="rec-capa-editor-caja" style={{ left: rect.x, top: rect.y, width: rect.w }}>
      <div
        className={`rec-capa-barra${barraArriba ? "" : " is-abajo"}`}
        role="toolbar"
        aria-label={`Formato de ${etiqueta}`}
        onMouseDown={(event) => event.preventDefault()}
      >
        <button type="button" className={`rec-capa-barra-btn${negrita ? " is-on" : ""}`} aria-pressed={negrita} aria-label="Negrita" title={rotuloDeAtajo("Negrita", "B")} onClick={() => alternar("bold")}>
          <Bold size={14} aria-hidden />
        </button>
        <button type="button" className={`rec-capa-barra-btn${cursiva ? " is-on" : ""}`} aria-pressed={cursiva} aria-label="Cursiva" title={rotuloDeAtajo("Cursiva", "I")} onClick={() => alternar("italic")}>
          <Italic size={14} aria-hidden />
        </button>
        <button
          type="button"
          className="rec-capa-barra-btn"
          aria-label="Enlace"
          title={opciones.enlaces ? rotuloDeAtajo("Enlace", "K") : "Este texto no admite enlaces"}
          aria-disabled={!opciones.enlaces || undefined}
          onClick={abrirEnlace}
        >
          <Link2 size={14} aria-hidden />
        </button>
        <button type="button" className="rec-capa-barra-btn rec-capa-barra-btn--texto" aria-label="Insertar un campo" title="Campo de cada persona (escribe {{)" onClick={abrirMenu}>
          <Variable size={14} aria-hidden /> Campo
        </button>
        <span className="rec-capa-barra-sep" aria-hidden />
        <span className="rec-capa-barra-pista" aria-hidden>
          {esPunto ? <><CornerDownLeft size={12} /> nuevo punto</> : opciones.multilinea ? <><CornerDownLeft size={12} /> salto de línea</> : <>Esc para salir</>}
        </span>
        <button type="button" className="rec-capa-barra-btn rec-capa-barra-btn--listo" aria-label="Terminar de editar" title="Listo (Esc)" onClick={() => { volcar(); onTerminar("listo"); }}>
          <Check size={14} aria-hidden /> Listo
        </button>
      </div>
      <div
        ref={editable}
        className="rec-capa-editor"
        style={estilo}
        role="textbox"
        aria-multiline={opciones.multilinea || undefined}
        aria-label={etiqueta}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onKeyDown={onKeyDown}
        onInput={onInput}
        onPaste={onPaste}
        onBlur={onBlur}
        onClick={onClick}
        onKeyUp={onSeleccion}
        onMouseUp={onSeleccion}
        onDrop={(event) => event.preventDefault()}
      />
      {aviso ? <p className="rec-capa-editor-aviso" role="status">{aviso}</p> : null}
      {menu ? (
        <MenuDeCampos
          campos={campos}
          estilo={{ left: menu.x - rect.x, top: menu.y - rect.y, width: ANCHO_DEL_MENU }}
          onElegir={insertarCampo}
          onCerrar={() => {
            const r = menu.rango;
            setMenu(null);
            editable.current?.focus({ preventScroll: true });
            if (r) ponerRango(r);
          }}
        />
      ) : null}
      {enlace ? (
        <PopoverDeEnlace
          url={enlace.url}
          texto={enlace.texto}
          existente={Boolean(enlace.existente)}
          estilo={{ left: enlace.x - rect.x, top: enlace.y - rect.y, width: ANCHO_DEL_ENLACE }}
          onAplicar={aplicarEnlace}
          onQuitar={quitarEnlace}
          onCerrar={() => {
            const r = enlace.rango;
            setEnlace(null);
            editable.current?.focus({ preventScroll: true });
            if (r) ponerRango(r);
          }}
        />
      ) : null}
    </div>
  );
}
