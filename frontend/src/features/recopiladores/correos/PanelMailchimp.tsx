import { useState } from "react";

import { downloadUrl } from "../../../api/core";
import type { MailExportPayload, MailExportScope, MailReview, MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { Check, Copy, Download, FolderOpen, Loader2, Upload } from "../../../vendor/lucide-react";
import { etiquetasDeMailchimp, pesoLegible, revisionBloquea } from "./modeloCorreo";
import { SalidasDelEnvio } from "./SalidasDelEnvio";

type Props = {
  /** Rótulo del envío que se exporta, si la campaña tiene más de uno. */
  envio?: string | null;
  template: MailTemplate;
  revision: MailReview | null;
  exportacion: MailExportPayload | null;
  /** Qué salida se está armando, o `null`. */
  exportando: MailExportScope | null;
  ocupado: boolean;
  /** HTML de la vista previa actual, para copiarlo a Outlook. */
  htmlActual: string | null;
  onExportar: (scope: MailExportScope) => void;
  onGuardarJunto: () => void;
  onVerRevision: () => void;
};

async function copiarHtml(html: string): Promise<void> {
  const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  if (clip && typeof ClipboardItem !== "undefined" && typeof clip.write === "function") {
    const tipo = "text/html";
    await clip.write([new ClipboardItem({
      [tipo]: new Blob([html], { type: tipo }),
      "text/plain": new Blob([html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()], { type: "text/plain" }),
    })]);
    return;
  }
  if (clip?.writeText) {
    await clip.writeText(html);
    return;
  }
  throw new Error("Este equipo no deja copiar al portapapeles.");
}

/**
 * Pie del inspector: qué etiqueta lleva cada campo y la salida para Mailchimp.
 *
 * El envío masivo se hace en Mailchimp, no desde la app (ADR 0110 §2): aquí no
 * hay botón de enviar. Hay dos salidas (E1g): la plantilla sola, un ZIP que se
 * importa en Mailchimp sin datos personales, y la plantilla con la audiencia
 * en CSV. «Copiar para Outlook» queda como salida secundaria.
 */
export function PanelMailchimp({
  envio = null,
  template,
  revision,
  exportacion,
  exportando,
  ocupado,
  htmlActual,
  onExportar,
  onGuardarJunto,
  onVerRevision,
}: Props) {
  const [copia, setCopia] = useState<"" | "ok" | "error">("");
  const etiquetas = etiquetasDeMailchimp(template);
  const bloqueaPlantilla = revisionBloquea(revision, "plantilla");
  const bloqueaCompleto = revisionBloquea(revision, "completo");
  const zip = exportacion?.zip ?? null;

  const copiar = async () => {
    if (!htmlActual) return;
    try {
      await copiarHtml(htmlActual);
      setCopia("ok");
    } catch {
      setCopia("error");
    }
    window.setTimeout(() => setCopia(""), 2400);
  };

  return (
    <footer className="rec-mail-mc" aria-label="Para Mailchimp">
      <span className="xfk-over">Para Mailchimp{envio ? ` · ${envio}` : ""}</span>
      <dl
        className="rec-mail-mc-etiquetas"
        data-qa-geometry-group="material-campo/correo/etiquetas"
        data-qa-geometry-contract="equal"
      >
        {etiquetas.map((e) => (
          <div key={e.key} className="rec-mail-mc-etiqueta">
            <dt className="rec-mail-token-texto">{e.app}</dt>
            <dd><span aria-hidden className="rec-mail-flecha">→</span><span className="xfk-mono">{e.mc}</span></dd>
          </div>
        ))}
      </dl>
      <p className="rec-mail-ayuda">
        En Mailchimp: Plantillas › Crear › Code your own › Import zip; las imágenes se suben solas. La audiencia va
        aparte, en CSV con una columna por etiqueta.
      </p>
      <span className="rec-mail-botones">
        <PulsoButton
          variant="primary"
          size="sm"
          disabled={ocupado || bloqueaPlantilla}
          title={bloqueaPlantilla ? "La revisión tiene puntos por corregir" : "Sin datos personales"}
          onClick={() => onExportar("plantilla")}
        >
          {exportando === "plantilla" ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
          Plantilla para importar en Mailchimp
        </PulsoButton>
        <PulsoButton
          variant="secondary"
          size="sm"
          disabled={ocupado || bloqueaCompleto}
          title={bloqueaCompleto ? "La revisión tiene puntos por corregir" : "Incluye la audiencia: contiene datos personales"}
          onClick={() => onExportar("completo")}
        >
          {exportando === "completo" ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
          Plantilla + audiencia
        </PulsoButton>
        <PulsoButton variant="ghost" size="sm" disabled={!htmlActual} onClick={() => { void copiar(); }}>
          {copia === "ok" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copia === "ok" ? "Copiado" : "Copiar para Outlook"}
        </PulsoButton>
      </span>
      <SalidasDelEnvio plataforma="mailchimp" />
      {bloqueaCompleto ? (
        <button type="button" className="rec-mail-link" onClick={onVerRevision}>
          Ver qué falta corregir ({revision?.errors ?? 0})
        </button>
      ) : null}
      {copia === "error" ? <p className="rec-mail-problema-linea" role="status">No se pudo copiar al portapapeles.</p> : null}
      {zip ? (
        <div className="rec-mail-mc-listo" role="status">
          <span className="rec-mail-mc-listo-nombre">
            <b className="xfk-mono">{zip.filename}</b>
            <span>
              {pesoLegible(zip.size_bytes)}
              {exportacion?.scope === "plantilla" ? " · sin datos personales" : " · contiene datos personales"}
            </span>
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
