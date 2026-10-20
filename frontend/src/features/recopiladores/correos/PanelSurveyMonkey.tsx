// Salida para SurveyMonkey (addendum E1j §1 y §5).
//
// En SurveyMonkey el correo se pega como «HTML personalizado» en el
// recopilador. El pie del inspector da:
// - «Copiar HTML para SurveyMonkey»: el HTML del envío que se mira con las
//   etiquetas de la plataforma (`mode: "export"`), NO el de la vista previa;
// - el paquete del envío (ZIP con el HTML, el LEEME y el manifiesto);
// - los pasos en la plataforma y la tabla `{{campo}} → [CustomDataN]`, que se
//   edita aquí mismo (`fields[].sm`).
//
// Con SurveyMonkey los contactos viven en su recopilador: la pestaña
// Destinatarios es un estado C5 legítimo (`DestinatariosEnSurveyMonkey`), sin
// importador.

import { useId, useState } from "react";

import { downloadUrl } from "../../../api/core";
import type { MailExportPayload, MailReview, MailSend, MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { Check, Copy, Download, FolderOpen, Inbox, Loader2, Upload } from "../../../vendor/lucide-react";
import { camposDeEnlace, conDestino, conEtiquetaSurveyMonkey, etiquetasDePlataforma, motivoSinEtiqueta, opcionesSurveyMonkey, problemaDeEtiquetas } from "./dialectos";
import { pesoLegible, revisionBloquea } from "./modeloCorreo";
import { pasosEnSurveyMonkey, rotuloDeEnvio } from "./modeloEnvios";
import "./correosEnvios.css";
import { SalidasDelEnvio } from "./SalidasDelEnvio";

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
  template: MailTemplate;
  envio: MailSend;
  revision: MailReview | null;
  exportacion: MailExportPayload | null;
  exportando: boolean;
  ocupado: boolean;
  onEditar: (update: (t: MailTemplate) => MailTemplate) => void;
  /** El HTML del envío para pegar en SurveyMonkey (`mode: "export"`); `null` si no se pudo. */
  onHtml: () => Promise<string | null>;
  /** Con la lista cargada el paquete trae los contactos con su saludo (datos personales). */
  conLista?: boolean;
  onExportar: () => void;
  onGuardarJunto: () => void;
  onVerRevision: () => void;
};

export function PanelSurveyMonkey({
  template,
  envio,
  revision,
  exportacion,
  exportando,
  ocupado,
  onEditar,
  onHtml,
  conLista = false,
  onExportar,
  onGuardarJunto,
  onVerRevision,
}: Props) {
  const [copia, setCopia] = useState<"" | "copiando" | "ok" | "error">("");
  const bloquea = revisionBloquea(revision, "plantilla");
  const bloqueaPaquete = revisionBloquea(revision, conLista ? "completo" : "plantilla");
  const zip = exportacion?.zip ?? null;
  const pasos = pasosEnSurveyMonkey(envio);

  const copiar = async () => {
    setCopia("copiando");
    const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    setCopia(await copiarHtmlParaPegar(onHtml, clip));
    window.setTimeout(() => setCopia(""), 2400);
  };

  return (
    <footer className="rec-mail-mc rec-sm" aria-label="Para SurveyMonkey">
      <span className="xfk-over">Para SurveyMonkey · {rotuloDeEnvio(envio)}</span>
      <MapeoSurveyMonkey template={template} onEditar={onEditar} />
      <ol className="rec-sm-pasos" aria-label="Dónde se pega en SurveyMonkey">
        {pasos.map((p, i) => <li key={`${i}-${p}`}>{p}</li>)}
      </ol>
      <p className="rec-mail-ayuda">
        {envio.kind === "invitacion"
          ? "Pega el HTML en el formato «HTML personalizado», que requiere plan Enterprise."
          : "Pega el HTML en el mensaje del recordatorio; el formato «HTML personalizado» requiere plan Enterprise."}
      </p>
      <span className="rec-mail-botones">
        <PulsoButton
          variant="primary"
          size="sm"
          disabled={ocupado || bloquea || copia === "copiando"}
          title={bloquea ? "La revisión tiene puntos por corregir" : "Copia el código con las etiquetas de SurveyMonkey"}
          onClick={() => { void copiar(); }}
        >
          {copia === "copiando" ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : copia === "ok" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copia === "ok" ? "HTML copiado" : "Copiar HTML para SurveyMonkey"}
        </PulsoButton>
        <PulsoButton
          variant="secondary"
          size="sm"
          disabled={ocupado || bloqueaPaquete}
          title={bloqueaPaquete
            ? "La revisión tiene puntos por corregir"
            : conLista
              ? "HTML, LEEME, manifiesto y contactos_surveymonkey.csv con el saludo: contiene datos personales"
              : "HTML, LEEME y manifiesto; sin datos personales"}
          onClick={onExportar}
        >
          {exportando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
          Paquete del envío
        </PulsoButton>
      </span>
      <SalidasDelEnvio plataforma="surveymonkey" />
      {bloquea ? (
        <button type="button" className="rec-mail-link" onClick={onVerRevision}>
          Ver qué falta corregir ({revision?.errors ?? 0})
        </button>
      ) : null}
      {copia === "error" ? <p className="rec-mail-problema-linea" role="status">No se pudo copiar el HTML al portapapeles.</p> : null}
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
    </footer>
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
