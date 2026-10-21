import type { MailCheck, MailReview, MailTemplate } from "../../../api/materialMail";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, XCircle } from "../../../vendor/lucide-react";
import { FOCO_COLUMNA_DEL_TRATO, comoArreglar, destinoDelChequeo } from "./comoArreglar";
import { IDENTIDAD, focoDelEstilo } from "./modeloEstilo";
import { fraseDeLoQueFalta, idsSinArchivo } from "./nombresDeImagen";
import { CABECERA, SOBRE, chequeosOrdenados, cifraDeChequeo, muestraDetalle, resumenDeRevision, rotuloDeChequeo, textoDeItem, CUERPO_DEL_INSPECTOR } from "./modeloCorreo";

type Props = {
  revision: MailReview | null;
  cargando: boolean;
  /**
   * Lleva al bloque del chequeo (lo elige en el correo y en el inspector).
   * `foco` nombra el control que se enfoca allí (`data-foco`), si no es el primero.
   */
  onIrAlBloque?: (blockId: string, foco?: string) => void;
  /** La plantilla del borrador: nombra cada imagen por su papel, no por su id. */
  template?: Pick<MailTemplate, "header" | "images" | "blocks"> | null;
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

function Chequeo({ check, onIrAlBloque, template }: { check: MailCheck; onIrAlBloque?: (blockId: string, foco?: string) => void; template?: Props["template"] }) {
  const destino = destinoDelChequeo(check, SOBRE);
  const arreglo = check.status !== "ok" ? comoArreglar(check.code) : null;
  const Icono = ICONO[check.status];
  // H7: «Falta el logo de la unidad solicitante y el de Pulso PUCP», sin ids.
  const faltan = check.code === "images_available" && check.status !== "ok" && template
    ? fraseDeLoQueFalta(template, idsSinArchivo(check.items))
    : null;
  const detalle = faltan ?? (muestraDetalle(check) ? check.detail : "");
  const items = faltan
    ? []
    : check.code === "fields_empty"
    ? check.items.filter((i) => typeof i !== "string" && Number(i.empty) > 0)
    : check.code === "tags_have_columns" && check.status === "ok"
      ? []
      : check.items;
  return (
    <li className={`rec-mail-chk is-${check.status}`}>
      <Icono size={15} aria-hidden className="rec-mail-chk-icono" />
      <span className="rec-mail-chk-rotulo">
        {rotuloDeChequeo(check)}
        <span className="pulso-sr-only"> ({VOZ[check.status]})</span>
      </span>
      {detalle || items.length ? (
        <span className="rec-mail-chk-texto">
          {detalle ? <span className="rec-mail-chk-detalle">{detalle}</span> : null}
          {items.length ? (
            <span className="rec-mail-chk-items" data-qa-geometry-group="material-campo/correo/chequeo-items" data-qa-geometry-contract="intrinsic">
              {items.map((item, i) => <span key={i} className="xfk-mono">{textoDeItem(item)}</span>)}
            </span>
          ) : null}
        </span>
      ) : null}
      <span className="rec-mail-chk-cifra">{cifraDeChequeo(check)}</span>
      {arreglo || (destino && onIrAlBloque) ? (
        <span className="rec-mail-chk-salida">
          {arreglo ? <span className="rec-mail-chk-arreglo">{arreglo}</span> : null}
          {destino && onIrAlBloque ? (() => {
            const salida = salidaDelChequeo(check.code, destino, check.targets.find((t) => t.block_id === destino)?.prop);
            return (
              <button type="button" className="rec-mail-link rec-mail-chk-ir" onClick={() => onIrAlBloque(destino, salida.foco)}>
                {salida.texto} <ArrowRight size={12} aria-hidden />
              </button>
            );
          })() : null}
        </span>
      ) : null}
    </li>
  );
}

/** Pestaña «Revisión»: lo que el backend comprueba antes de dejar exportar. */
export function PanelRevision({ revision, cargando, onIrAlBloque, template = null }: Props) {
  return (
    <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo">
      <div className="rec-mail-insp-cabeza">
        <h3>Antes de exportar</h3>
        <p className="rec-mail-revision-resumen" aria-live="polite">
          {cargando ? <Loader2 size={13} className="pulso-spin" aria-hidden /> : null}
          {revision ? resumenDeRevision(revision.errors, revision.warnings) : cargando ? "Revisando…" : "Sin revisar todavía."}
        </p>
      </div>
      {revision ? (
        <ul
          className="rec-mail-chks"
          aria-label="Chequeos del correo"
          data-qa-geometry-group="material-campo/correo/chequeos"
          data-qa-geometry-contract="intrinsic"
        >
          {chequeosOrdenados(revision.checks).map((check, i) => <Chequeo key={`${check.code}-${i}`} check={check} onIrAlBloque={onIrAlBloque} template={template} />)}
        </ul>
      ) : null}
    </div>
  );
}
