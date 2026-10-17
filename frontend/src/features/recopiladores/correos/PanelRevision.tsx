import type { MailCheck, MailReview } from "../../../api/materialMail";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "../../../vendor/lucide-react";
import { chequeosOrdenados, cifraDeChequeo, muestraDetalle, resumenDeRevision, rotuloDeChequeo, textoDeItem, CUERPO_DEL_INSPECTOR } from "./modeloCorreo";

type Props = {
  revision: MailReview | null;
  cargando: boolean;
};

const ICONO = { ok: CheckCircle2, warning: AlertCircle, error: XCircle } as const;
const VOZ = { ok: "bien", warning: "aviso", error: "por corregir" } as const;

function Chequeo({ check }: { check: MailCheck }) {
  const Icono = ICONO[check.status];
  const detalle = muestraDetalle(check);
  const items = check.code === "fields_empty"
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
          {detalle ? <span className="rec-mail-chk-detalle">{check.detail}</span> : null}
          {items.length ? (
            <span className="rec-mail-chk-items" data-qa-geometry-group="material-campo/catalogo/correos-chequeo-items" data-qa-geometry-contract="intrinsic">
              {items.map((item, i) => <span key={i} className="xfk-mono">{textoDeItem(item)}</span>)}
            </span>
          ) : null}
        </span>
      ) : null}
      <span className="rec-mail-chk-cifra">{cifraDeChequeo(check)}</span>
    </li>
  );
}

/** Pestaña «Revisión»: lo que el backend comprueba antes de dejar exportar. */
export function PanelRevision({ revision, cargando }: Props) {
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
          data-qa-geometry-group="material-campo/catalogo/correos-chequeos"
          data-qa-geometry-contract="intrinsic"
        >
          {chequeosOrdenados(revision.checks).map((check, i) => <Chequeo key={`${check.code}-${i}`} check={check} />)}
        </ul>
      ) : null}
    </div>
  );
}
