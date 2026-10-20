// Envíos de la campaña (addendum E1k §5): `?panel=correo-envios`, clase
// «inspector». La invitación y sus recordatorios comparten el cuerpo del correo;
// cada envío cambia su etiqueta, su fecha prevista, a quién va, su asunto, su
// preheader y una apertura propia, que va justo después del saludo.
//
// Los envíos se guardan con «Guardar», junto con la plantilla. Exportar un
// envío exporta lo guardado: si hay cambios, se guardan antes.
//
// Contrato de Superficie:
// - C1: `material-campo/catalogo/correos-envios`, contrato equal; cada envío
//   es una fila miembro (su rótulo, su fecha y a quién va).
// - C2: de 1 a 6 filas de la misma altura; el detalle del elegido va debajo,
//   fuera del grupo. C4: el dueño de scroll es el inspector.

import { useId } from "react";

import type { MailPlatform, MailSend, MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { AlertTriangle, Loader2, Plus, Trash2, Upload } from "../../../vendor/lucide-react";
import { CampoDeTexto } from "./CampoDeTexto";
import { CUERPO_DEL_INSPECTOR } from "./modeloCorreo";
import {
  AUDIENCIAS_DE_RECORDATORIO,
  LARGO_APERTURA,
  LARGO_ETIQUETA,
  MAX_ENVIOS,
  ROTULO_DE_AUDIENCIA,
  avisosDeFechas,
  esIdLocal,
  fechaCorta,
  puedeAgregar,
} from "./modeloEnvios";
import "./correosEnvios.css";

type Props = {
  envios: readonly MailSend[];
  activo: MailSend;
  template: Pick<MailTemplate, "subject" | "preheader">;
  plataforma: MailPlatform;
  /** Hay cambios sin guardar (exportar los guarda antes). */
  porGuardar: boolean;
  ocupado: boolean;
  exportando: boolean;
  onElegir: (sendId: string) => void;
  onAgregar: () => void;
  onQuitar: (sendId: string) => void;
  onEditar: (sendId: string, cambio: Partial<Omit<MailSend, "send_id" | "kind">>) => void;
  onExportar: () => void;
};

export function PanelEnvios({
  envios,
  activo,
  template,
  plataforma,
  porGuardar,
  ocupado,
  exportando,
  onElegir,
  onAgregar,
  onQuitar,
  onEditar,
  onExportar,
}: Props) {
  const ids = useId();
  const avisos = avisosDeFechas(envios);
  const avisoDelActivo = avisos.find((a) => a.sendId === activo.send_id);
  const esRecordatorio = activo.kind === "recordatorio";
  const editar = (cambio: Partial<Omit<MailSend, "send_id" | "kind">>) => onEditar(activo.send_id, cambio);

  return (
    <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo rec-env">
      <div className="rec-mail-insp-cabeza">
        <h3>Envíos de la campaña</h3>
        <p>El cuerpo es el mismo; cada envío cambia su asunto, su apertura y a quién va.</p>
      </div>

      <ul
        className="rec-env-filas"
        data-qa-geometry-group="material-campo/catalogo/correos-envios"
        data-qa-geometry-contract="equal"
        aria-label="Envíos"
      >
        {envios.map((e) => {
          const actual = e.send_id === activo.send_id;
          const conAviso = avisos.some((a) => a.sendId === e.send_id);
          return (
            <li key={e.send_id} className={`rec-env-fila${actual ? " is-active" : ""}`} data-qa-geometry-member>
              <button
                type="button"
                className="rec-env-fila-elegir"
                aria-current={actual ? "true" : undefined}
                onClick={() => onElegir(e.send_id)}
              >
                <span className="rec-env-fila-textos">
                  <b>{e.label}</b>
                  <span>
                    {fechaCorta(e.date) || "Sin fecha"} · {e.kind === "invitacion" ? "a todos" : ROTULO_DE_AUDIENCIA[e.audience].toLocaleLowerCase("es-PE")}
                  </span>
                </span>
                <span className="rec-env-fila-chips">
                  {e.opening ? <span className="rec-mail-chip">con apertura</span> : null}
                  {esIdLocal(e.send_id) ? <span className="rec-mail-chip is-warning">sin guardar</span> : null}
                  {conAviso ? <AlertTriangle size={13} aria-label="La fecha no viene después del envío anterior" className="rec-env-fila-aviso" /> : null}
                </span>
              </button>
              {e.kind === "recordatorio" ? (
                <PulsoButton
                  variant="icon"
                  size="sm"
                  className="rec-env-quitar"
                  aria-label={`Quitar ${e.label}`}
                  title="Quitar el recordatorio"
                  disabled={ocupado}
                  onClick={() => onQuitar(e.send_id)}
                >
                  <Trash2 size={14} aria-hidden />
                </PulsoButton>
              ) : <span className="rec-env-quitar" aria-hidden />}
            </li>
          );
        })}
      </ul>

      <span className="rec-env-agregar">
      <PulsoButton
        variant="secondary"
        size="sm"
        disabled={ocupado || !puedeAgregar(envios)}
        title={puedeAgregar(envios) ? "Un recordatorio para quienes no respondieron" : `Una campaña tiene hasta ${MAX_ENVIOS} envíos`}
        onClick={onAgregar}
      >
        <Plus size={14} aria-hidden /> Recordatorio
      </PulsoButton>
      </span>

      <section
        className="rec-env-detalle"
        aria-labelledby={`${ids}-titulo`}
        data-qa-geometry-group="material-campo/catalogo/correos-envio-detalle"
        data-qa-geometry-contract="intrinsic"
      >
        <h4 id={`${ids}-titulo`} className="rec-env-detalle-titulo">{activo.label}</h4>
        <CampoDeTexto
          label="Etiqueta"
          valor={activo.label}
          maximo={LARGO_ETIQUETA}
          onCambio={(label) => editar({ label })}
        />
        <span className="rec-env-par">
          <label className="rec-env-campo">
            <span className="rec-mail-campo-rotulo"><span>Fecha prevista</span></span>
            <input
              type="date"
              className="rec-mail-input"
              value={activo.date ?? ""}
              onChange={(ev) => editar({ date: ev.target.value })}
            />
          </label>
          <label className="rec-env-campo">
            <span className="rec-mail-campo-rotulo"><span>A quién</span></span>
            {esRecordatorio ? (
              <select
                className="rec-mail-select"
                value={activo.audience}
                onChange={(ev) => editar({ audience: ev.target.value as MailSend["audience"] })}
              >
                {AUDIENCIAS_DE_RECORDATORIO.map((a) => <option key={a} value={a}>{ROTULO_DE_AUDIENCIA[a]}</option>)}
              </select>
            ) : (
              <span className="rec-env-fijo">Todos los contactos</span>
            )}
          </label>
        </span>
        {avisoDelActivo ? <p className="rec-mail-problema-linea" role="status">{avisoDelActivo.detalle}</p> : null}
        {esRecordatorio && plataforma === "mailchimp" ? (
          <p className="rec-mail-ayuda">
            Mailchimp no sabe quién respondió: arma un segmento con quienes faltan antes de enviar.
          </p>
        ) : null}
        <CampoDeTexto
          label="Asunto"
          valor={activo.subject ?? ""}
          placeholder="El de la plantilla"
          ayuda={template.subject ? `Vacío: «${template.subject}».` : "Vacío: el de la plantilla."}
          maximo={80}
          onCambio={(subject) => editar({ subject })}
        />
        <CampoDeTexto
          label="Texto de vista previa"
          valor={activo.preheader ?? ""}
          placeholder="El de la plantilla"
          ayuda={template.preheader ? `Vacío: «${template.preheader}».` : "Vacío: el de la plantilla."}
          maximo={140}
          onCambio={(preheader) => editar({ preheader })}
        />
        <CampoDeTexto
          label="Apertura"
          valor={activo.opening ?? ""}
          multilinea
          filas={3}
          maximo={LARGO_APERTURA}
          placeholder={esRecordatorio ? "Le recordamos que aún puede responder la encuesta hasta el **viernes**." : "Sin apertura"}
          ayuda="Un párrafo que sólo lleva este envío, después del saludo. Admite **negrita**, {{campos}} y [enlaces](url)."
          onCambio={(opening) => editar({ opening })}
        />
        {plataforma === "surveymonkey" ? (
          <CampoDeTexto
            label="Recopilador"
            valor={activo.collector_label ?? ""}
            placeholder="Nombre o id del recopilador de SurveyMonkey"
            ayuda="Queda en el manifiesto del paquete, para saber por dónde salió."
            maximo={80}
            onCambio={(collector_label) => editar({ collector_label })}
          />
        ) : null}
        <span className="rec-env-exportar">
        <PulsoButton
          variant="secondary"
          size="sm"
          disabled={ocupado}
          title={porGuardar ? "Guarda los cambios y arma el paquete de este envío" : "Arma el paquete de este envío"}
          onClick={onExportar}
        >
          {exportando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
          {porGuardar ? `Guardar y exportar ${activo.label}` : `Exportar ${activo.label}`}
        </PulsoButton>
        </span>
      </section>
    </div>
  );
}
