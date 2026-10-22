import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import type { MailTemplate } from "../../../api/materialMail";
import { AlertTriangle, Loader2 } from "../../../vendor/lucide-react";
import { anchoDeLaHoja, paginaDelLienzo } from "./modeloAjustes";
import {
  escalaParaCaber,
  htmlParaLaVista,
  type PaletaOscura,
  type VistaDelCorreo,
} from "./modeloCorreo";
import { esHex } from "./modeloEstilo";
import { avisoDeVistaRetenida, camposNoDeclarados, rotuloDeClave } from "./camposDeclarados";
import { envioElegido, useCorreosStore } from "./store";

import "./correosEstilo.css";
import "./correosAjustes.css";

/** Lo que la capa de edición necesita para medirse sobre el correo. */
export type MedidasDeLaHoja = {
  doc: Document | null;
  /** Sube con cada carga del iframe: hay que volver a medir. */
  medida: number;
  escala: number;
  /** Tamaño de la hoja ya a escala. */
  ancho: number;
  alto: number;
};

type Props = {
  html: string | null;
  template: MailTemplate | null;
  vista: VistaDelCorreo;
  cargando: boolean;
  error: string;
  /** La capa de edición (E1g): se pinta dentro de la hoja, sobre el iframe. */
  capa?: (medidas: MedidasDeLaHoja) => ReactNode;
  /** Lo que va arriba del correo, en el flujo del lienzo (la guía de la primera visita): reserva su alto y no tapa la hoja. */
  encabezado?: ReactNode;
};

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

/** El fondo de la página en estilo Campaña (sin `page_bg`, el acento); `null` en Sobrio. */
export function paginaDeCampana(template: Pick<MailTemplate, "theme"> | null): string | null {
  if (template?.theme.estilo !== "campana") return null;
  const color = esHex(template.theme.page_bg) ? template.theme.page_bg : template.theme.accent;
  return esHex(color) ? color : null;
}

/**
 * El correo tal como lo arma el backend, en un iframe aislado.
 *
 * `sandbox` sin `allow-scripts`: el HTML no puede ejecutar nada. Con
 * `allow-same-origin` la vista puede medir su alto —el scroll es del lienzo,
 * no del iframe— y marcar el bloque elegido. Sin `allow-popups`, los enlaces
 * del correo no abren ventanas.
 */
export function VistaPreviaDelCorreo({ html, template, vista, cargando, error, capa, encabezado = null }: Props) {
  const marco = useRef<HTMLIFrameElement | null>(null);
  const lienzo = useRef<HTMLElement | null>(null);
  const medirLienzo = useRef<() => void>(() => {});
  const [doc, setDoc] = useState<Document | null>(null);
  const [medida, setMedida] = useState(0);
  const [alto, setAlto] = useState(720);
  const [disponible, setDisponible] = useState<number | null>(null);
  // Ancho que el correo pide de verdad: una franja de logos ancha puede exigir
  // más que el dispositivo simulado, y entonces se escala en vez de recortarse.
  const [anchoContenido, setAnchoContenido] = useState(0);
  const srcDoc = useMemo(() => (html ? htmlParaLaVista(html, vista, paletaOscura()) : ""), [html, vista]);
  const templateRef = useRef(template);
  templateRef.current = template;

  // Cada vista previa reemplaza el documento del iframe (H-b): la capa vuelve a
  // medir sobre el nuevo. Nada del documento recibe oyentes: la capa del padre
  // lo cubre entero y es la que recibe los clics.
  const alCargar = useCallback(() => {
    const d = marco.current?.contentDocument;
    if (!d || !templateRef.current) return;
    setAlto(Math.max(320, Math.ceil(d.documentElement.scrollHeight)));
    setAnchoContenido(Math.ceil(Math.max(d.documentElement.scrollWidth, d.body?.scrollWidth ?? 0)));
    medirLienzo.current();
    setDoc(d);
    setMedida((m) => m + 1);
  }, []);

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

  // Sin HTML no hay documento que medir.
  useEffect(() => { if (!srcDoc) setDoc(null); }, [srcDoc]);

  // Al cambiar de vista el ancho pedido se vuelve a medir con el HTML nuevo.
  useEffect(() => { setAnchoContenido(0); }, [vista, html]);

  // Campaña (E1n): en Escritorio la hoja es tan ancha como el lienzo y el
  // lienzo toma el fondo de la página —el color llena la ventana como en el
  // cliente de correo—; en Teléfono se ve la columna. Sobrio con fondo propio
  // (E1p): la hoja conserva su ancho y el lienzo de alrededor toma el fondo.
  // El ancho de la hoja sigue el elegido en Ajustes (560/600/640) y, si no
  // cabe, la hoja entera se escala: nunca se deforma.
  const base = anchoDeLaHoja(vista, template?.theme);
  const pagina = paginaDelLienzo(template, vista);
  const aTodoElAncho = paginaDeCampana(template) !== null && vista === "escritorio";
  const ancho = aTodoElAncho && disponible !== null && disponible > base
    ? Math.floor(disponible)
    : Math.max(base, anchoContenido);
  const escala = escalaParaCaber(disponible, ancho);
  const estiloDelLienzo = pagina ? ({ "--rec-mail-pagina": pagina } as CSSProperties) : undefined;

  // La hoja a todo el ancho cambia con el lienzo: el correo se recentra y la
  // capa vuelve a medir sobre el mismo documento.
  useEffect(() => {
    if (!aTodoElAncho || !doc) return;
    setAlto(Math.max(320, Math.ceil(doc.documentElement.scrollHeight)));
    setMedida((m) => m + 1);
  }, [aTodoElAncho, ancho, doc]);

  return (
    <section
      ref={lienzo}
      className={`rec-mail-lienzo${vista === "oscuro" ? " is-oscuro" : ""}${aTodoElAncho ? " is-campana" : ""}${pagina ? " is-pagina" : ""}`}
      style={estiloDelLienzo}
      aria-label="Vista previa del correo"
      aria-busy={cargando}
      data-qa-geometry-capacity="owned"
    >
      {encabezado}
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
            tabIndex={-1}
            aria-hidden={capa ? true : undefined}
            title={`Correo en vista ${vista === "telefono" ? "de teléfono" : vista === "oscuro" ? "de modo oscuro" : "de escritorio"}`}
            className="rec-mail-iframe"
            sandbox="allow-same-origin"
            srcDoc={srcDoc}
            onLoad={alCargar}
            scrolling="no"
            style={{ width: ancho, height: alto, transform: escala < 1 ? `scale(${escala})` : undefined }}
          />
          {capa ? capa({ doc, medida, escala, ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) }) : null}
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
export function VistaPreviaDelCorreoConectada({ capa, encabezado }: { capa?: (medidas: MedidasDeLaHoja) => ReactNode; encabezado?: ReactNode }) {
  const html = useCorreosStore((s) => s.vistaPrevia?.html ?? null);
  const template = useCorreosStore((s) => s.borrador);
  const vista = useCorreosStore((s) => s.vista);
  const cargando = useCorreosStore((s) => s.vistaPreviaCargando);
  const error = useCorreosStore((s) => s.vistaPreviaError);
  const conProblemas = useCorreosStore((s) => s.problemas.length > 0);
  // N5: un campo no declarado retiene la vista previa; el lienzo dice cuál. Se
  // lee como texto para que el selector no devuelva un arreglo nuevo cada vez.
  const fuera = useCorreosStore((s) => (s.borrador ? camposNoDeclarados(s.borrador, envioElegido(s)).join("\n") : ""));
  const retenida = fuera ? avisoDeVistaRetenida(fuera.split("\n").map(rotuloDeClave)) : "";
  return (
    <VistaPreviaDelCorreo
      html={html}
      template={template}
      vista={vista}
      cargando={cargando}
      error={retenida || (error
        ? conProblemas
          ? "La vista previa no refleja el último cambio: hay bloques por corregir, marcados en la lista."
          : error
        : "")}
      capa={capa}
      encabezado={encabezado}
    />
  );
}
