import { useState, type ReactNode } from "react";

import type { MailExportScope, MailReview } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { copiarTexto } from "../../../lib/portapapeles";
import { Check, Copy, Upload } from "../../../vendor/lucide-react";
import { VerLosPuntos } from "./VerLosPuntos";
import { revisionBloquea } from "./modeloCorreo";
import { SALIDAS_DEL_ENVIO } from "./modeloSalidas";
import "./correosExportar.css";

/**
 * Los pasos en el orden de la pantalla de campaña de Mailchimp, una línea cada uno. Salen de la prueba real con
 * Acreditación (2026-10-21): sin etiqueta salió «All subscribed contacts», un remitente fuera del dominio verificado
 * dispara el aviso y la prueba de envío muestra «<< Test … >>» porque no llena los campos.
 */
const PASOS_MAILCHIMP: readonly { donde: string; que: string }[] = [
  { donde: "Audiencia:", que: "importa audiencia.csv y ponle una etiqueta." },
  { donde: "To:", que: 'elige esa etiqueta, no "All subscribed contacts".' },
  { donde: "From:", que: "un correo del dominio que verificaron en Mailchimp." },
  { donde: "Content:", que: "Code your own › Import zip con este archivo; las imágenes se suben solas." },
  { donde: '"Send",', que: 'no "Send a test email": la prueba muestra "<< Test … >>" porque no llena los campos.' },
];

type Props = {
  /** Rótulo del envío que se exporta, si la campaña tiene más de uno. */
  envio?: string | null;
  revision: MailReview | null;
  /** Hay algo en curso (guardar, exportar…): las salidas se deshabilitan; la espera la dice el contenedor. */
  ocupado: boolean;
  /** HTML de la vista previa actual, para copiarlo a Outlook. */
  htmlActual: string | null;
  onExportar: (scope: MailExportScope) => void;
  /** Cierra Exportar y abre la Revisión (#13). */
  onVerRevision?: () => void;
};

async function copiarHtml(html: string): Promise<void> {
  const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  if (clip && typeof ClipboardItem !== "undefined" && typeof clip.write === "function") {
    const tipo = "text/html";
    try {
      await clip.write([new ClipboardItem({
        [tipo]: new Blob([html], { type: tipo }),
        "text/plain": new Blob([html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()], { type: "text/plain" }),
      })]);
      return;
    } catch {
      // Electron puede negar la escritura enriquecida: sigue como texto.
    }
  }
  // copiarTexto lanza si ni la API ni execCommand pudieron copiar.
  await copiarTexto(html);
}

/**
 * Lo que sale para Mailchimp, dentro de «Exportar ▾» de la barra (F7; antes,
 * el pie del inspector).
 *
 * El envío masivo se hace en Mailchimp, no desde la app (ADR 0110 §2): aquí no
 * hay botón de enviar. Hay dos salidas (E1g): la plantilla sola, un ZIP que se
 * importa en Mailchimp sin datos personales, y la plantilla con la audiencia
 * en CSV. «Copiar para Outlook» queda como salida secundaria. Las etiquetas de
 * cada campo se ven y se editan en Personas. El ZIP se espera y se entrega en
 * el contenedor anclado a «Exportar» (ADR 0133).
 */
export function PanelMailchimp({
  envio = null,
  revision,
  ocupado,
  htmlActual,
  onExportar,
  onVerRevision,
}: Props) {
  const [copia, setCopia] = useState<"" | "ok" | "error">("");
  const bloqueaPlantilla = revisionBloquea(revision, "plantilla");
  const bloqueaCompleto = revisionBloquea(revision, "completo");
  const [plantilla, completo, outlook] = SALIDAS_DEL_ENVIO.mailchimp;

  const copiar = async () => {
    if (!htmlActual) return;
    try {
      await copiarHtml(htmlActual);
      setCopia("ok");
      window.setTimeout(() => setCopia(""), 2400);
    } catch {
      setCopia("error");
    }
  };

  const salida = (
    s: typeof plantilla,
    disabled: boolean,
    onClick: () => void,
    icono: ReactNode,
    titulo?: string,
  ) => (
    <li data-qa-geometry-member>
      <button type="button" className={`rec-exp-salida${s.principal ? " is-principal" : ""}`} disabled={disabled} title={titulo} onClick={onClick}>
        <span className="rec-exp-salida-titulo">
          {icono}
          {s.accion}
          {s.principal ? <span className="rec-mail-salida-principal">principal</span> : null}
        </span>
        <span className="rec-exp-salida-para">{s.para}</span>
      </button>
    </li>
  );

  return (
    <div className="rec-exp-cuerpo" aria-label={`Para Mailchimp${envio ? ` · ${envio}` : ""}`}>
      <span className="xfk-over">Para Mailchimp{envio ? ` · ${envio}` : ""}</span>
      <ul className="rec-exp-salidas" data-qa-geometry-group="material-campo/correo/salidas-mailchimp" data-qa-geometry-contract="intrinsic">
        {salida(plantilla, ocupado || bloqueaPlantilla, () => onExportar("plantilla"), <Upload size={14} aria-hidden />,
          "Sin datos personales")}
        {salida(completo, ocupado || bloqueaCompleto, () => onExportar("completo"), <Upload size={14} aria-hidden />,
          "Incluye la audiencia: contiene datos personales")}
        {salida(outlook, !htmlActual, () => { void copiar(); },
          copia === "ok" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />)}
      </ul>
      {bloqueaCompleto ? (
        <p className="rec-exp-bloqueo" role="status">
          {bloqueaPlantilla
            ? <VerLosPuntos errores={revision?.errors ?? 0} onVer={onVerRevision} />
            : "La audiencia espera la lista: impórtala en Personas."}
        </p>
      ) : null}
      {copia === "error" ? (
        <div className="rec-exp-respaldo" role="status">
          <p className="rec-mail-problema-linea">No se pudo copiar al portapapeles.</p>
          <PulsoButton variant="secondary" size="sm" disabled={ocupado || bloqueaPlantilla} onClick={() => onExportar("plantilla")}>
            <Upload size={14} aria-hidden /> Generar la plantilla
          </PulsoButton>
        </div>
      ) : null}
      <div className="rec-exp-pasos">
        <span className="xfk-over">En Mailchimp</span>
        <ol>
          {PASOS_MAILCHIMP.map((paso) => (
            <li key={paso.donde}>
              <b>{paso.donde}</b> {paso.que}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
