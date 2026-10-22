// Salida para SurveyMonkey (addendum E1j §1 y §5).
//
// En SurveyMonkey el correo se pega como «HTML personalizado» en el
// recopilador. «Exportar ▾» de la barra da (antes, el pie del inspector):
// - «Copiar HTML para SurveyMonkey»: el HTML del envío que se mira con las
//   etiquetas de la plataforma (`mode: "export"`), NO el de la vista previa;
// - el paquete del envío (ZIP con el HTML, el LEEME y el manifiesto);
// - los pasos en la plataforma. La tabla `{{campo}} → [CustomDataN]`
//   (`fields[].sm`) vive en Personas, junto a los campos (F5).
//
// Con SurveyMonkey los contactos viven en su recopilador: la pestaña
// Destinatarios es un estado C5 legítimo (`DestinatariosEnSurveyMonkey`), sin
// importador.

import { useId, useState } from "react";

import { downloadUrl } from "../../../api/core";
import type { MailExportPayload, MailReview, MailSend, MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { Check, Copy, Download, FolderOpen, Inbox, Loader2, Upload } from "../../../vendor/lucide-react";
import { VerLosPuntos } from "./VerLosPuntos";
import { camposDeEnlace, conDestino, conEtiquetaSurveyMonkey, etiquetasDePlataforma, motivoSinEtiqueta, opcionesSurveyMonkey, problemaDeEtiquetas } from "./dialectos";
import { pesoLegible, revisionBloquea } from "./modeloCorreo";
import { pasosEnSurveyMonkey, rotuloDeEnvio } from "./modeloEnvios";
import { SALIDAS_DEL_ENVIO } from "./modeloSalidas";
import "./correosEnvios.css";
import "./correosExportar.css";

const SIN_ETIQUETA = "";

/**
 * Copia el HTML que devuelve `pedirHtml` (el de `mode: "export"`, con las
 * etiquetas de SurveyMonkey) como texto: es código para la caja de HTML
 * personalizado, no un correo con formato.
 */
export async function copiarHtmlParaPegar(
  pedirHtml: () => Promise<string | null>,
  clip: Pick<Clipboard, "writeText"> | undefined,
): Promise<"ok" | "error"> {
  if (!clip?.writeText) return "error";
  const html = await pedirHtml();
  if (!html) return "error";
  try {
    await clip.writeText(html);
    return "ok";
  } catch {
    return "error";
  }
}

/** La tabla `{{campo}} → [CustomDataN]`; con `onEditar`, cada campo se elige en un selector. */
export function MapeoSurveyMonkey({
  template,
  onEditar,
}: {
  template: MailTemplate;
  onEditar?: (update: (t: MailTemplate) => MailTemplate) => void;
}) {
  const ids = useId();
  const filas = etiquetasDePlataforma(template, "surveymonkey");
  const enlaces = new Set(camposDeEnlace(template));
  const problemas = problemaDeEtiquetas(template);
  const opciones = opcionesSurveyMonkey();
  return (
    <dl
      className="rec-mail-mc-etiquetas rec-sm-mapeo"
      // Intrínseco: una fila crece con su aviso o con la pregunta del destino.
      data-qa-geometry-group="material-campo/correo/etiquetas-surveymonkey"
      data-qa-geometry-contract="intrinsic"
    >
      {filas.map((f) => {
        const field = template.fields.find((x) => x.key === f.key);
        const problema = problemas[f.key];
        return (
          <div key={f.key} className="rec-mail-mc-etiqueta rec-sm-fila" data-qa-geometry-member>
            <dt className="rec-mail-token-texto">{f.app}</dt>
            <dd>
              <span aria-hidden className="rec-mail-flecha">→</span>
              {field && onEditar ? (
                <select
                  className={`rec-mail-select rec-sm-select${!field.sm || problema ? " is-error" : ""}`}
                  aria-label={`Etiqueta de SurveyMonkey para ${f.app}`}
                  aria-describedby={problema ? `${ids}-${f.key}` : undefined}
                  value={field.sm ?? SIN_ETIQUETA}
                  onChange={(e) => onEditar((t) => conEtiquetaSurveyMonkey(t, f.key, e.target.value || null))}
                >
                  <option value={SIN_ETIQUETA}>Sin etiqueta</option>
                  {opciones.map((o) => {
                    const motivo = motivoSinEtiqueta(field, o);
                    return <option key={o} value={o} disabled={Boolean(motivo)} title={motivo ?? undefined}>[{o}]{motivo ? " · no aplica" : ""}</option>;
                  })}
                </select>
              ) : (
                <span className={`xfk-mono${f.plataforma ? "" : " rec-sm-falta"}`}>{f.plataforma ?? "sin etiqueta"}</span>
              )}
            </dd>
            {problema ? <p className="rec-mail-problema-linea rec-sm-problema" id={`${ids}-${f.key}`}>{problema}</p> : null}
            {field && onEditar && enlaces.has(f.key) && !field.destino ? (
              <p className="rec-sm-pregunta" role="group" aria-label={`A dónde lleva ${f.app}`}>
                <span>¿Este enlace es la encuesta?</span>
                <button type="button" className="rec-mail-link" onClick={() => onEditar((t) => conDestino(t, f.key, "encuesta"))}>Sí, es la encuesta</button>
                <button type="button" className="rec-mail-link" onClick={() => onEditar((t) => conDestino(t, f.key, "otro"))}>No, es otro enlace</button>
              </p>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}

type Props = {
  envio: MailSend;
  revision: MailReview | null;
  exportacion: MailExportPayload | null;
  exportando: boolean;
  ocupado: boolean;
  /** El HTML del envío para pegar en SurveyMonkey (`mode: "export"`); `null` si no se pudo. */
  onHtml: () => Promise<string | null>;
  /** Con la lista cargada el paquete trae los contactos con su saludo (datos personales). */
  conLista?: boolean;
  onExportar: () => void;
  onGuardarJunto: () => void;
  /** Cierra Exportar y abre la Revisión (#13). */
  onVerRevision?: () => void;
};

/**
 * Lo que sale para SurveyMonkey, dentro de «Exportar ▾» de la barra (F7): la
 * acción principal (copiar el HTML), el paquete de respaldo, dónde se pega y
 * el ZIP listo. Lo que falta corregir lo dice la cuenta de la pestaña
 * Revisión: aquí sólo se nombra por qué no se puede todavía.
 */
export function PanelSurveyMonkey({
  envio,
  revision,
  exportacion,
  exportando,
  ocupado,
  onHtml,
  conLista = false,
  onExportar,
  onGuardarJunto,
  onVerRevision,
}: Props) {
  const [copia, setCopia] = useState<"" | "copiando" | "ok" | "error">("");
  // F17: si el portapapeles no deja, el HTML queda a la vista para seleccionarlo.
  const [htmlDeRespaldo, setHtmlDeRespaldo] = useState<string | null>(null);
  const bloquea = revisionBloquea(revision, "plantilla");
  const bloqueaPaquete = revisionBloquea(revision, conLista ? "completo" : "plantilla");
  const zip = exportacion?.zip ?? null;
  const pasos = pasosEnSurveyMonkey(envio);
  const [principal, paquete] = SALIDAS_DEL_ENVIO.surveymonkey;

  const copiar = async () => {
    setCopia("copiando");
    setHtmlDeRespaldo(null);
    const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    let html: string | null = null;
    const out = await copiarHtmlParaPegar(async () => { html = await onHtml(); return html; }, clip);
    setCopia(out);
    if (out === "error") setHtmlDeRespaldo(html);
    else window.setTimeout(() => setCopia(""), 2400);
  };

  return (
    <div className="rec-exp-cuerpo" aria-label={`Para SurveyMonkey · ${rotuloDeEnvio(envio)}`}>
      <span className="xfk-over">Para SurveyMonkey · {rotuloDeEnvio(envio)}</span>
      <ul className="rec-exp-salidas" data-qa-geometry-group="material-campo/correo/salidas-surveymonkey" data-qa-geometry-contract="intrinsic">
        <li data-qa-geometry-member>
          <button
            type="button"
            className="rec-exp-salida is-principal"
            disabled={ocupado || bloquea || copia === "copiando"}
            onClick={() => { void copiar(); }}
          >
            <span className="rec-exp-salida-titulo">
              {copia === "copiando" ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : copia === "ok" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copia === "ok" ? "HTML copiado" : principal.accion}
              <span className="rec-mail-salida-principal">principal</span>
            </span>
            <span className="rec-exp-salida-para">{principal.para}</span>
          </button>
        </li>
        <li data-qa-geometry-member>
          <button
            type="button"
            className="rec-exp-salida"
            disabled={ocupado || bloqueaPaquete}
            title={conLista
              ? "HTML, LEEME, manifiesto y contactos_surveymonkey.csv con el saludo: contiene datos personales"
              : "HTML, LEEME y manifiesto; sin datos personales"}
            onClick={onExportar}
          >
            <span className="rec-exp-salida-titulo">
              {exportando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
              {paquete.accion}
            </span>
            <span className="rec-exp-salida-para">{paquete.para}</span>
          </button>
        </li>
      </ul>
      {bloquea || bloqueaPaquete ? (
        <p className="rec-exp-bloqueo" role="status">
          <VerLosPuntos errores={revision?.errors ?? 0} onVer={onVerRevision} />
        </p>
      ) : null}
      {copia === "error" ? (
        <div className="rec-exp-respaldo" role="status">
          <p className="rec-mail-problema-linea">No se pudo copiar al portapapeles.</p>
          {htmlDeRespaldo ? (
            <label className="rec-exp-respaldo-html">
              <span>Selecciona el HTML y cópialo a mano</span>
              <textarea readOnly rows={4} value={htmlDeRespaldo} onFocus={(e) => e.currentTarget.select()} />
            </label>
          ) : null}
          <PulsoButton variant="secondary" size="sm" disabled={ocupado || bloqueaPaquete} onClick={onExportar}>
            <Download size={14} aria-hidden /> Descargar el paquete
          </PulsoButton>
        </div>
      ) : null}
      <ol className="rec-sm-pasos" aria-label="Dónde se pega en SurveyMonkey">
        {pasos.map((p, i) => <li key={`${i}-${p}`}>{p}</li>)}
      </ol>
      <p className="rec-mail-ayuda">
        {envio.kind === "invitacion"
          ? "Pega el HTML en el formato «HTML personalizado», que requiere plan Enterprise."
          : "Pega el HTML en el mensaje del recordatorio; el formato «HTML personalizado» requiere plan Enterprise."}
      </p>
      {zip ? (
        <div className="rec-mail-mc-listo" role="status">
          <span className="rec-mail-mc-listo-nombre">
            <b className="xfk-mono">{zip.filename}</b>
            <span>{pesoLegible(zip.size_bytes)}{exportacion?.scope === "completo" ? " · contiene datos personales" : " · sin datos personales"}</span>
          </span>
          <span className="rec-mail-botones">
            <a className="pulso-button pulso-button--secondary pulso-button--sm" href={downloadUrl(zip.file_id)} download={zip.filename}>
              <Download size={14} aria-hidden /> Descargar
            </a>
            <PulsoButton variant="ghost" size="sm" disabled={ocupado} onClick={onGuardarJunto}>
              <FolderOpen size={14} aria-hidden /> Junto al proyecto
            </PulsoButton>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Destinatarios de una campaña de SurveyMonkey (C5, vacío legítimo): los
 * contactos se cargan en el recopilador, con sus columnas de datos. La
 * correspondencia de campos vive en un solo sitio: la tabla del pie.
 */
export function DestinatariosEnSurveyMonkey() {
  // C8: la lista ya no es un vacío en SurveyMonkey. Es opcional: los contactos
  // viven en el recopilador, pero con la lista el paquete trae
  // contactos_surveymonkey.csv con el saludo ya escrito para cada persona.
  return (
    <p className="rec-mail-ayuda rec-sm-lista-opcional" role="note">
      <Inbox size={14} aria-hidden /> Opcional: carga la lista si quieres el archivo de contactos con el saludo listo para el
      recopilador. La app no la envía; vive sólo en esta sesión.
    </p>
  );
}
