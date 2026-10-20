import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MailTemplate } from "../../../api/materialMail";
import { AlertTriangle, Loader2 } from "../../../vendor/lucide-react";
import {
  ANCHO_DE_VISTA,
  escalaParaCaber,
  esZonaDelCorreo,
  htmlParaLaVista,
  type PaletaOscura,
  type VistaDelCorreo,
} from "./modeloCorreo";
import { useCorreosStore } from "./store";

type Props = {
  html: string | null;
  template: MailTemplate | null;
  vista: VistaDelCorreo;
  seleccion: string;
  cargando: boolean;
  error: string;
  onSeleccionar: (id: string) => void;
};

/** Color del acento del módulo, leído del documento: el iframe no hereda tokens. */
function acentoDelModulo(nodo: Element | null): string {
  if (!nodo || typeof getComputedStyle !== "function") return "currentColor";
  const valor = getComputedStyle(nodo).getPropertyValue("--pulso-module-fieldkit").trim();
  return valor || "currentColor";
}

/** El modo oscuro con los colores del sistema visual, no con unos propios. */
function paletaOscura(): PaletaOscura | undefined {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") return undefined;
  const raiz = getComputedStyle(document.documentElement);
  const token = (nombre: string) => raiz.getPropertyValue(nombre).trim();
  const papel = token("--pulso-text");
  const tinta = token("--pulso-surface-3");
  if (!papel || !tinta) return undefined;
  return { papel, tinta, suave: `color-mix(in srgb, ${papel} 82%, ${tinta})` };
}

type Zonas = Map<string, HTMLElement>;

/**
 * Encuentra la celda de cada bloque en el HTML del correo por las marcas que
 * pone el render en modo vista previa (`data-pulso-block`). La fila de un
 * bloque marca su `<tr>` y se resalta su celda; el pie marca la celda misma.
 * Sin marcas, el mapa queda vacío y la vista sigue siendo sólo lectura.
 */
function zonasDelCorreo(doc: Document, template: MailTemplate): Zonas {
  const zonas: Zonas = new Map();
  doc.querySelectorAll<HTMLElement>("[data-pulso-block]").forEach((el) => {
    const id = el.getAttribute("data-pulso-block");
    if (!esZonaDelCorreo(id, template) || zonas.has(id)) return;
    const celda = el instanceof HTMLTableRowElement || el.tagName === "TR"
      ? ((el as HTMLTableRowElement).cells[0] ?? el)
      : el;
    zonas.set(id, celda);
  });
  return zonas;
}

/**
 * El correo tal como lo arma el backend, en un iframe aislado.
 *
 * `sandbox` sin `allow-scripts`: el HTML no puede ejecutar nada. Con
 * `allow-same-origin` la vista puede medir su alto —el scroll es del lienzo,
 * no del iframe— y marcar el bloque elegido. Sin `allow-popups`, los enlaces
 * del correo no abren ventanas.
 */
export function VistaPreviaDelCorreo({ html, template, vista, seleccion, cargando, error, onSeleccionar }: Props) {
  const marco = useRef<HTMLIFrameElement | null>(null);
  const lienzo = useRef<HTMLElement | null>(null);
  const medirLienzo = useRef<() => void>(() => {});
  const zonas = useRef<Zonas>(new Map());
  const [alto, setAlto] = useState(720);
  const [disponible, setDisponible] = useState<number | null>(null);
  // Ancho que el correo pide de verdad: una franja de logos ancha puede exigir
  // más que el dispositivo simulado, y entonces se escala en vez de recortarse.
  const [anchoContenido, setAnchoContenido] = useState(0);
  const srcDoc = useMemo(() => (html ? htmlParaLaVista(html, vista, paletaOscura()) : ""), [html, vista]);
  const templateRef = useRef(template);
  templateRef.current = template;
  const onSeleccionarRef = useRef(onSeleccionar);
  onSeleccionarRef.current = onSeleccionar;
  const seleccionRef = useRef(seleccion);
  seleccionRef.current = seleccion;

  const marcar = useCallback(() => {
    const acento = acentoDelModulo(marco.current);
    zonas.current.forEach((td, id) => {
      const elegido = id === seleccionRef.current;
      td.style.outline = elegido ? `2px solid ${acento}` : "";
      td.style.outlineOffset = elegido ? "-2px" : "";
    });
  }, []);

  const alCargar = useCallback(() => {
    const doc = marco.current?.contentDocument;
    const tpl = templateRef.current;
    if (!doc || !tpl) return;
    setAlto(Math.max(320, Math.ceil(doc.documentElement.scrollHeight)));
    setAnchoContenido(Math.ceil(Math.max(doc.documentElement.scrollWidth, doc.body?.scrollWidth ?? 0)));
    medirLienzo.current();
    zonas.current = zonasDelCorreo(doc, tpl);
    zonas.current.forEach((td, id) => {
      td.style.cursor = "pointer";
      td.addEventListener("click", (event) => {
        event.preventDefault();
        onSeleccionarRef.current(id);
      });
    });
    // Un enlace del correo no navega dentro de la vista previa.
    doc.querySelectorAll("a").forEach((a) => a.addEventListener("click", (event) => event.preventDefault()));
    marcar();
  }, [marcar]);

  useEffect(() => { marcar(); }, [seleccion, marcar]);

  // El ancho que deja el lienzo: si no alcanza, el correo se muestra a escala
  // en vez de recortarse o de reflujar como si fuera otro dispositivo.
  useEffect(() => {
    const nodo = lienzo.current;
    if (!nodo) return;
    const medir = () => {
      const cs = getComputedStyle(nodo);
      setDisponible(nodo.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    };
    medirLienzo.current = medir;
    medir();
    window.addEventListener("resize", medir);
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    observador?.observe(nodo);
    return () => {
      observador?.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, []);

  // Al cambiar de vista el ancho pedido se vuelve a medir con el HTML nuevo.
  useEffect(() => { setAnchoContenido(0); }, [vista, html]);

  const ancho = Math.max(ANCHO_DE_VISTA[vista], anchoContenido);
  const escala = escalaParaCaber(disponible, ancho);

  return (
    <section
      ref={lienzo}
      className={`rec-mail-lienzo${vista === "oscuro" ? " is-oscuro" : ""}`}
      aria-label="Vista previa del correo"
      aria-busy={cargando}
      data-qa-geometry-capacity="owned"
    >
      {error ? (
        <p className="rec-mail-lienzo-aviso" role="status">
          <AlertTriangle size={14} aria-hidden /> {error}
        </p>
      ) : null}
      {srcDoc ? (
        <div
          className="rec-mail-hoja"
          style={{ width: Math.round(ancho * escala), height: Math.round(alto * escala) }}
          data-escala={escala < 1 ? escala.toFixed(2) : undefined}
        >
          <iframe
            ref={marco}
            title={`Correo en vista ${vista === "telefono" ? "de teléfono" : vista === "oscuro" ? "de modo oscuro" : "de escritorio"}`}
            className="rec-mail-iframe"
            sandbox="allow-same-origin"
            srcDoc={srcDoc}
            onLoad={alCargar}
            scrolling="no"
            style={{ width: ancho, height: alto, transform: escala < 1 ? `scale(${escala})` : undefined }}
          />
        </div>
      ) : (
        <div className="rec-mail-hoja rec-mail-hoja--vacia" style={{ width: ancho }}>
          {cargando ? <Loader2 size={18} className="pulso-spin" aria-hidden /> : null}
          <span>{cargando ? "Armando el correo…" : "Sin vista previa todavía."}</span>
        </div>
      )}
    </section>
  );
}

/** La vista previa lee del store por su cuenta: re-renderiza sola al llegar el HTML. */
export function VistaPreviaDelCorreoConectada({ onSeleccionar, conSeleccion }: { onSeleccionar: (id: string) => void; conSeleccion: boolean }) {
  const html = useCorreosStore((s) => s.vistaPrevia?.html ?? null);
  const template = useCorreosStore((s) => s.borrador);
  const vista = useCorreosStore((s) => s.vista);
  const seleccion = useCorreosStore((s) => s.seleccion);
  const cargando = useCorreosStore((s) => s.vistaPreviaCargando);
  const error = useCorreosStore((s) => s.vistaPreviaError);
  const conProblemas = useCorreosStore((s) => s.problemas.length > 0);
  return (
    <VistaPreviaDelCorreo
      html={html}
      template={template}
      vista={vista}
      seleccion={conSeleccion ? seleccion : ""}
      cargando={cargando}
      error={error
        ? conProblemas
          ? "La vista previa no refleja el último cambio: hay bloques por corregir, marcados en la lista."
          : error
        : ""}
      onSeleccionar={onSeleccionar}
    />
  );
}
