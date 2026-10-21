import { useId, useState } from "react";
import { useInRouterContext, useLocation, useNavigate } from "react-router-dom";

import type { MailCheck, MailReview, MailTemplate } from "../../../api/materialMail";
import { searchConPanel } from "../../../lib/navegacion/paneles";
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight, Loader2, XCircle } from "../../../vendor/lucide-react";
import { FOCO_COLUMNA_DEL_TRATO, arregloEnLaRevision, causaDelChequeo, destinoDelChequeo, pestanaDelChequeo, type PestanaDelChequeo } from "./comoArreglar";
import { IDENTIDAD, focoDelEstilo } from "./modeloEstilo";
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
};

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
function ChequeoQueFalla({ check, onIrAlBloque, template }: { check: MailCheck; onIrAlBloque?: (blockId: string, foco?: string) => void; template?: Props["template"] }) {
  const enRouter = useInRouterContext();
  const destino = destinoDelChequeo(check, SOBRE);
  const pestana = destino ? null : pestanaDelChequeo(check);
  const arreglo = arregloEnLaRevision(check.code);
  const Icono = ICONO[check.status];
  // H7: «Falta el logo de la unidad solicitante y el de Pulso PUCP», sin ids.
  const faltan = check.code === "images_available" && template
    ? fraseDeLoQueFalta(template, idsSinArchivo(check.items))
    : null;
  const causa = faltan ?? causaDelChequeo(check) ?? (muestraDetalle(check) ? check.detail : "");
  const items = faltan
    ? []
    : check.code === "fields_empty"
      ? check.items.filter((i) => typeof i !== "string" && Number(i.empty) > 0)
      : check.items;
  const cifra = cifraDeChequeo(check);
  const salida = destino && onIrAlBloque
    ? salidaDelChequeo(check.code, destino, check.targets.find((t) => t.block_id === destino)?.prop)
    : null;
  return (
    <li className={`rec-mail-chk rec-mail-rev-falla is-${check.status}`} data-qa-geometry-member>
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
          {arreglo ? <span className="rec-mail-chk-arreglo">{arreglo}</span> : null}
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

/** Lo que está en orden, en una línea: rótulo y cifra; la cifra técnica, en el `title`. */
function ChequeoEnOrden({ check }: { check: MailCheck }) {
  // Un chequeo que esta versión no conoce no tiene rótulo propio: su detalle dice qué se revisó.
  const detalle = muestraDetalle(check) ? check.detail : "";
  return (
    <li className="rec-mail-rev-ok" data-qa-geometry-member>
      <CheckCircle2 size={13} aria-hidden className="rec-mail-rev-ok-icono" />
      <span className="rec-mail-rev-ok-rotulo">
        {rotuloDeChequeo(check)}
        {detalle ? <span className="rec-mail-rev-ok-detalle"> · {detalle}</span> : null}
      </span>
      <span className="rec-mail-rev-ok-cifra" title={tituloDeChequeo(check)}>{cifraDeChequeo(check)}</span>
    </li>
  );
}

/** Pestaña «Revisión»: arriba lo que falla; lo que está en orden, plegado en una línea (H8). */
export function PanelRevision({ revision, cargando, onIrAlBloque, template = null }: Props) {
  const [abierto, setAbierto] = useState(false);
  const idLista = useId();
  const abrirExportar = useCorreosStore((s) => s.setExportarAbierto);
  const partes = revision ? partesDeRevision(revision.checks) : null;
  const fallas = partes ? [...partes.porCorregir, ...partes.avisos] : [];
  const todoEnOrden = Boolean(revision && partes && !fallas.length);
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
          className="rec-mail-chks"
          aria-label="Lo que falta corregir y los avisos"
          data-qa-geometry-group="material-campo/correo/chequeos"
          data-qa-geometry-contract="intrinsic"
        >
          {fallas.map((check, i) => <ChequeoQueFalla key={`${check.code}-${i}`} check={check} onIrAlBloque={onIrAlBloque} template={template} />)}
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
