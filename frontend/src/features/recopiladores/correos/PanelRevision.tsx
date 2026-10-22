import { useEffect, useId, useRef, useState } from "react";
import { useInRouterContext, useLocation, useNavigate } from "react-router-dom";

import type { MailCheck, MailReview, MailTemplate } from "../../../api/materialMail";
import { searchConPanel } from "../../../lib/navegacion/paneles";
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight, Loader2, XCircle } from "../../../vendor/lucide-react";
import { FOCO_COLUMNA_DEL_TRATO, arregloEnLaRevision, causaDelChequeo, destinoDelChequeo, pestanaDelChequeo, type PestanaDelChequeo } from "./comoArreglar";
import { IDENTIDAD, focoDelEstilo } from "./modeloEstilo";
import { fraseDeNitidez } from "./nitidez";
import { fraseDeLoQueFalta, idsSinArchivo } from "./nombresDeImagen";
import { PANEL_CORREO_DESTINATARIOS, PANEL_CORREO_ENVIOS } from "./panelesCorreos";
import { useCorreosStore } from "./store";
import { CABECERA, SOBRE, cifraDeChequeo, muestraDetalle, partesDeRevision, resumenDeRevision, rotuloDeChequeo, textoDeItem, tituloDeChequeo, CUERPO_DEL_INSPECTOR } from "./modeloCorreo";
import "./correosRevision.css";

type Props = {
  revision: MailReview | null;
  cargando: boolean;
  /**
   * Lleva al bloque del chequeo (lo elige en el correo y en el inspector).
   * `foco` nombra el control que se enfoca allí (`data-foco`), si no es el primero.
   */
  onIrAlBloque?: (blockId: string, foco?: string) => void;
  /** La plantilla del borrador: nombra cada imagen por su papel, no por su id. */
  template?: Pick<MailTemplate, "header" | "images" | "blocks" | "fields"> | null;
  /**
   * #8: la zona cuyo punto de aviso se pulsó en el correo. Su primer chequeo
   * recibe el foco, se trae a la vista y se resalta un momento.
   */
  resaltar?: string | null;
  onResaltado?: () => void;
};

/**
 * Centra el chequeo en el inspector, que es su dueño de scroll; sólo si el
 * inspector no hace scroll propio se mueve la página. Así el correo no salta
 * y sigue a la vista el punto que se pulsó.
 */
function traerALaVista(el: HTMLElement): void {
  const insp = el.closest<HTMLElement>(".rec-mail-insp");
  if (insp && insp.scrollHeight > insp.clientHeight + 1 && getComputedStyle(insp).overflowY !== "visible") {
    const delta = el.getBoundingClientRect().top - insp.getBoundingClientRect().top;
    insp.scrollTop += delta - (insp.clientHeight - el.offsetHeight) / 2;
    return;
  }
  el.scrollIntoView?.({ block: "nearest" });
}

/** Cuánto dura el resaltado del chequeo al que llevó un punto del correo. */
export const DURACION_DEL_RESALTADO = 1600;

/** El texto del botón de salida de un chequeo: lo que hace, en la voz de la vista. */
export function salidaDelChequeo(code: string, destino: string, prop?: string): { texto: string; foco?: string } {
  // F2: el saludo por sexo se arregla eligiendo la columna, con el foco en el selector.
  if (code === "greeting_trato") return { texto: "Elegir columna", foco: FOCO_COLUMNA_DEL_TRATO };
  // H7: el logo que falta se sube en Identidad.
  if (code === "images_available" && destino === CABECERA) return { texto: "Subir en Identidad" };
  // F15: la cabecera sin descripción se corrige en Identidad, que es adonde lleva.
  if (destino === CABECERA) return { texto: "Ir a Identidad" };
  // E1n: el contraste de Campaña se corrige en Identidad › Estilo, en el control del color.
  if (destino === IDENTIDAD) return { texto: "Ir a Identidad", foco: focoDelEstilo(prop) };
  if (destino === SOBRE) return { texto: "Ir al asunto" };
  return { texto: "Ir al bloque" };
}

const ICONO = { ok: CheckCircle2, warning: AlertCircle, error: XCircle } as const;
const VOZ = { ok: "bien", warning: "aviso", error: "por corregir" } as const;

const PANEL_DE_PESTANA = { destinatarios: PANEL_CORREO_DESTINATARIOS, envios: PANEL_CORREO_ENVIOS } as const;
const TEXTO_DE_PESTANA: Record<PestanaDelChequeo, string> = { destinatarios: "Ir a Personas", envios: "Ir a Envíos" };

/** Un chequeo sin bloque se corrige en Personas o Envíos: el botón abre esa pestaña. */
function IrAPestana({ pestana }: { pestana: PestanaDelChequeo }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="rec-mail-link rec-mail-chk-ir"
      onClick={() => navigate({ pathname: location.pathname, search: searchConPanel(location.search, PANEL_DE_PESTANA[pestana]) }, { replace: true })}
    >
      {TEXTO_DE_PESTANA[pestana]} <ArrowRight size={12} aria-hidden />
    </button>
  );
}

/** Lo que falla: rótulo, una línea de causa, una de arreglo y su botón de ir. */
function ChequeoQueFalla({ check, onIrAlBloque, template, resaltado = false }: { check: MailCheck; onIrAlBloque?: (blockId: string, foco?: string) => void; template?: Props["template"]; resaltado?: boolean }) {
  const enRouter = useInRouterContext();
  const destino = destinoDelChequeo(check, SOBRE);
  const pestana = destino ? null : pestanaDelChequeo(check);
  const arregloGeneral = arregloEnLaRevision(check.code);
  const Icono = ICONO[check.status];
  // H7: «Falta el logo de la unidad solicitante y el de Pulso PUCP», sin ids.
  const faltan = check.code === "images_available" && template
    ? fraseDeLoQueFalta(template, idsSinArchivo(check.items))
    : null;
  // #9: la nitidez dice cuál imagen y de cuántos px subirla, bloque por bloque.
  const nitidez = check.code === "image_width" && template
    ? [...new Set(check.targets.map((t) => t.block_id))]
      .map((id) => fraseDeNitidez(check, template.blocks.find((b) => b.block_id === id)))
      .filter((f): f is string => Boolean(f))
      .join(" ")
    : "";
  // Con la frase de nitidez el arreglo ya está dicho («súbela de al menos N px»).
  const arreglo = nitidez ? null : arregloGeneral;
  const causa = faltan ?? (nitidez || null) ?? causaDelChequeo(check) ?? (muestraDetalle(check) ? check.detail : "");
  // El resumen del saludo por sexo y las medidas de cada imagen viajan en
  // `items` para la máquina, no para leerse.
  const items = faltan || check.code === "greeting_trato" || check.code === "image_width"
    ? []
    : check.code === "fields_empty"
      ? check.items.filter((i) => typeof i !== "string" && Number(i.empty) > 0)
      : check.items;
  const cifra = cifraDeChequeo(check);
  const salida = destino && onIrAlBloque
    ? salidaDelChequeo(check.code, destino, check.targets.find((t) => t.block_id === destino)?.prop)
    : null;
  return (
    <li
      className={`rec-mail-chk rec-mail-rev-falla is-${check.status}${resaltado ? " is-resaltado" : ""}`}
      data-qa-geometry-member
      data-chequeo={check.code}
      tabIndex={-1}
    >
      <Icono size={16} aria-hidden className="rec-mail-chk-icono" />
      <span className="rec-mail-chk-rotulo">
        {rotuloDeChequeo(check)}
        <span className="pulso-sr-only"> ({VOZ[check.status]})</span>
      </span>
      {cifra ? <span className="rec-mail-chk-cifra" title={tituloDeChequeo(check)}>{cifra}</span> : null}
      {causa || items.length ? (
        <span className="rec-mail-chk-texto">
          {causa ? <span className="rec-mail-chk-detalle">{causa}</span> : null}
          {items.length ? (
            <span className="rec-mail-chk-items" data-qa-geometry-group="material-campo/correo/chequeo-items" data-qa-geometry-contract="intrinsic">
              {items.map((item, i) => <span key={i} data-qa-geometry-member>{textoDeItem(item, template?.fields)}</span>)}
            </span>
          ) : null}
        </span>
      ) : null}
      {arreglo || salida || (pestana && enRouter) ? (
        <span className="rec-mail-chk-salida">
          {arreglo ? (
            <span className="rec-mail-chk-arreglo">
              {/* #14: el arreglo nombra el enlace con su rótulo real («Ir al asunto», «Ir al bloque»). */}
              {salida ? arreglo.replace("«Ir al bloque»", `«${salida.texto}»`) : arreglo}
            </span>
          ) : null}
          {salida && destino && onIrAlBloque ? (
            <button type="button" className="rec-mail-link rec-mail-chk-ir" onClick={() => onIrAlBloque(destino, salida.foco)}>
              {salida.texto} <ArrowRight size={12} aria-hidden />
            </button>
          ) : pestana && enRouter ? <IrAPestana pestana={pestana} /> : null}
        </span>
      ) : null}
    </li>
  );
}

/** Cifras de medida (peso en KB, largo en caracteres): se consultan, no se leen. */
const CIFRA_TECNICA = /\b(KB|car\.)/;

/** Lo que está en orden, en una línea: rótulo y cifra; la cifra técnica, en el `title`. */
function ChequeoEnOrden({ check }: { check: MailCheck }) {
  // Un chequeo que esta versión no conoce no tiene rótulo propio: su detalle dice qué se revisó.
  const detalle = muestraDetalle(check) ? check.detail : "";
  // #14: las cifras técnicas (KB, caracteres) van al `title`; a la vista, sólo las que se leen.
  const cifra = cifraDeChequeo(check);
  const tecnica = CIFRA_TECNICA.test(cifra);
  return (
    <li className="rec-mail-rev-ok" data-qa-geometry-member title={tecnica ? cifra : undefined}>
      <CheckCircle2 size={13} aria-hidden className="rec-mail-rev-ok-icono" />
      <span className="rec-mail-rev-ok-rotulo">
        {rotuloDeChequeo(check)}
        {detalle ? <span className="rec-mail-rev-ok-detalle"> · {detalle}</span> : null}
      </span>
      {tecnica ? null : <span className="rec-mail-rev-ok-cifra" title={tituloDeChequeo(check)}>{cifra}</span>}
    </li>
  );
}

/** Pestaña «Revisión»: arriba lo que falla; lo que está en orden, plegado en una línea (H8). */
export function PanelRevision({ revision, cargando, onIrAlBloque, template = null, resaltar = null, onResaltado }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState<number | null>(null);
  const lista = useRef<HTMLUListElement | null>(null);
  const idLista = useId();
  const abrirExportar = useCorreosStore((s) => s.setExportarAbierto);
  const partes = revision ? partesDeRevision(revision.checks) : null;
  const fallas = partes ? [...partes.porCorregir, ...partes.avisos] : [];
  const todoEnOrden = Boolean(revision && partes && !fallas.length);
  const indiceDeLaZona = resaltar ? fallas.findIndex((c) => c.targets.some((t) => t.block_id === resaltar)) : -1;

  // #8: el chequeo de la zona pulsada recibe el foco, se trae a la vista y se resalta.
  useEffect(() => {
    if (!resaltar || !revision) return;
    onResaltado?.();
    if (indiceDeLaZona < 0) return;
    const li = lista.current?.children.item(indiceDeLaZona);
    if (li instanceof HTMLElement) {
      traerALaVista(li);
      li.focus({ preventScroll: true });
    }
    setResaltado(indiceDeLaZona);
    // Sólo cuando llega una zona nueva: el resto lo lee de ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resaltar, revision]);
  useEffect(() => {
    if (resaltado === null) return;
    const t = window.setTimeout(() => setResaltado(null), DURACION_DEL_RESALTADO);
    return () => window.clearTimeout(t);
  }, [resaltado]);
  return (
    <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo">
      <div className="rec-mail-insp-cabeza">
        <h3>Antes de exportar</h3>
        <p className={`rec-mail-revision-resumen${todoEnOrden ? " is-listo" : ""}`} aria-live="polite">
          {cargando ? <Loader2 size={13} className="pulso-spin" aria-hidden /> : todoEnOrden ? <CheckCircle2 size={14} aria-hidden /> : null}
          {revision ? resumenDeRevision(revision.errors, revision.warnings) : cargando ? "Revisando…" : "Sin revisar todavía."}
        </p>
        {todoEnOrden ? (
          <button type="button" className="rec-mail-link rec-mail-rev-exportar" onClick={() => abrirExportar(true)}>
            Ir a Exportar <ArrowRight size={12} aria-hidden />
          </button>
        ) : null}
      </div>
      {fallas.length ? (
        <ul
          ref={lista}
          className="rec-mail-chks"
          aria-label="Lo que falta corregir y los avisos"
          data-qa-geometry-group="material-campo/correo/chequeos"
          data-qa-geometry-contract="intrinsic"
        >
          {fallas.map((check, i) => <ChequeoQueFalla key={`${check.code}-${i}`} check={check} onIrAlBloque={onIrAlBloque} template={template} resaltado={resaltado === i} />)}
        </ul>
      ) : null}
      {partes?.enOrden.length ? (
        <div className="rec-mail-rev-plegado">
          <button
            type="button"
            className="rec-mail-rev-plegado-boton"
            aria-expanded={abierto}
            aria-controls={idLista}
            onClick={() => setAbierto((v) => !v)}
          >
            <CheckCircle2 size={14} aria-hidden className="rec-mail-rev-ok-icono" />
            <span>{partes.enOrden.length} en orden</span>
            <ChevronRight size={14} aria-hidden className="rec-mail-rev-plegado-flecha" />
          </button>
          <ul
            id={idLista}
            hidden={!abierto}
            className="rec-mail-rev-enorden"
            aria-label="Chequeos en orden"
            data-qa-geometry-group="material-campo/correo/chequeos-en-orden"
            data-qa-geometry-contract="intrinsic"
          >
            {partes.enOrden.map((check, i) => <ChequeoEnOrden key={`${check.code}-${i}`} check={check} />)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
