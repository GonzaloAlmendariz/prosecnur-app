// Envíos de la campaña (addendum E1k §5): `?panel=correo-envios`, clase
// «inspector». La invitación y sus recordatorios comparten el cuerpo del correo;
// cada envío cambia su etiqueta, su fecha prevista, a quién va, su asunto, su
// preheader y una apertura propia, que va justo después del saludo.
//
// Los envíos se guardan con «Guardar», junto con la plantilla. Exportar un
// envío exporta lo guardado: si hay cambios, se guardan antes.
//
// Contrato de Superficie:
// - C1: `material-campo/correo/envios`, contrato equal; cada envío
//   es una fila miembro (su rótulo, su fecha y a quién va).
// - C2: de 1 a 6 filas de la misma altura; el detalle del elegido va debajo,
//   fuera del grupo. C4: el dueño de scroll es el inspector.
//
// La apertura se edita como el texto de un bloque (CampoConCampos): chips de
// campo, negrita y cursiva visibles, nunca asteriscos ni llaves. Lo que se
// guarda en `opening` sigue siendo el mismo texto del contrato.

import { useId, useRef, type CSSProperties } from "react";

import type { MailPlatform, MailProblem, MailSend, MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { AlertTriangle, CalendarDays, Loader2, Plus, Trash2, Upload } from "../../../vendor/lucide-react";
import { CampoConCampos } from "./CampoConCampos";
import { CampoDeTexto } from "./CampoDeTexto";
import { clavesDeclaradas, rotuloDeClave } from "./camposDeclarados";
import { SincronizarRespuestas } from "./SincronizarRespuestas";
import { avisosDeRecordatorio } from "./sincronizacionModel";
import { useCorreosStore } from "./store";
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
  marcaDeExportado,
  puedeAgregar,
} from "./modeloEnvios";
import "./correosEnvios.css";

type Props = {
  envios: readonly MailSend[];
  activo: MailSend;
  template: Pick<MailTemplate, "subject" | "preheader" | "fields">;
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
  /** Cuándo se exportó cada envío (`send_id` → ISO), del registro de la campaña (F16). */
  exportados?: Readonly<Record<string, string>>;
};

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;

/**
 * «viernes 30 de octubre» (es-PE), con el año sólo si no es el de `hoy`. Sin
 * Intl: el locale de Node sin ICU completo daría otro texto.
 */
export function fechaHumana(iso: string | undefined, hoy: Date = new Date()): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return "";
  const base = `${DIAS[fecha.getUTCDay()]} ${dia} de ${MESES[mes - 1]}`;
  return anio === hoy.getFullYear() ? base : `${base} de ${anio}`;
}

/** Qué sale si el asunto o la vista previa del envío quedan vacíos. */
export function ayudaDeVacio(dePlantilla: string | undefined): string {
  return dePlantilla ? `Si lo dejas vacío, va: «${dePlantilla}».` : "Si lo dejas vacío, va el de la plantilla.";
}

/** Los campos de la apertura se ven con el mismo rótulo que en el lienzo. */
export function camposDeLaApertura(template: Pick<MailTemplate, "fields">) {
  const declaradas = clavesDeclaradas(template);
  const rotulo = (key: string) => (key === "nombre" ? "Nombre" : template.fields.find((f) => f.key === key)?.label || rotuloDeClave(key));
  return {
    rotuloDeCampo: rotulo,
    ayudaDeCampo: (key: string) => `${rotulo(key)}: cambia con cada persona`,
    campoValido: (key: string) => declaradas.has(key),
  };
}

export const EJEMPLO_DE_APERTURA = "Ej.: Le recordamos que aún puede responder hasta el viernes";

/** Una apertura de puro espacio no se guarda (editarEnvio la quita): no se repinta. */
const sinEspacioSuelto = (texto: string) => (texto.trim() ? texto : "");

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
  exportados = {},
}: Props) {
  const ids = useId();
  const campana = useCorreosStore((s) => s.campana);
  const avisos = avisosDeFechas(envios);
  const avisoDelActivo = avisos.find((a) => a.sendId === activo.send_id);
  const esRecordatorio = activo.kind === "recordatorio";
  const editar = (cambio: Partial<Omit<MailSend, "send_id" | "kind">>) => onEditar(activo.send_id, cambio);
  const invitacion = envios.find((e) => e.kind === "invitacion");
  const asuntoDe = (e: MailSend | undefined) => (e?.subject?.trim() || template.subject || "");
  const avisosGmail = esRecordatorio ? avisosDeRecordatorio(asuntoDe(activo), asuntoDe(invitacion), activo.opening) : [];
  const fechaNativa = useRef<HTMLInputElement | null>(null);
  const fechaLegible = fechaHumana(activo.date);
  const apertura = activo.opening ?? "";
  const aperturaLarga: MailProblem[] = apertura.length > LARGO_APERTURA
    ? [{ path: "opening", code: "too_long", detail: `La apertura pasa del largo que admite el envío (${LARGO_APERTURA} caracteres). Acórtala.` }]
    : [];
  const abrirCalendario = () => {
    const input = fechaNativa.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  return (
    <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo rec-env">
      <div className="rec-mail-insp-cabeza">
        <h3>Envíos de la campaña</h3>
        <p>El cuerpo es el mismo; cada envío cambia su asunto, su apertura y a quién va.</p>
      </div>

      <ul
        className="rec-env-filas"
        data-qa-geometry-group="material-campo/correo/envios"
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
                    {marcaDeExportado(exportados[e.send_id]) ? ` · ${marcaDeExportado(exportados[e.send_id])}` : ""}
                  </span>
                </span>
                <span className="rec-env-fila-chips">
                  {e.opening ? <span className="rec-mail-chip">con apertura</span> : null}
                  {/* Un solo «sin guardar» en la vista: el de la barra (F6). Éste dice que el envío es nuevo. */}
                  {esIdLocal(e.send_id) ? <span className="rec-mail-chip">nuevo</span> : null}
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
        data-qa-geometry-group="material-campo/correo/envio-detalle"
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
          <span className="rec-env-campo">
            <span className="rec-mail-campo-rotulo"><span id={`${ids}-fecha`}>Fecha prevista</span></span>
            {/* La fecha se lee como se dice («viernes 30 de octubre»); el calendario es el del sistema. */}
            <span className="rec-env-fecha">
              <button
                type="button"
                className={`rec-env-fecha-boton${fechaLegible ? "" : " is-vacia"}`}
                aria-labelledby={`${ids}-fecha ${ids}-fecha-valor`}
                onClick={abrirCalendario}
              >
                <CalendarDays size={14} aria-hidden />
                <span id={`${ids}-fecha-valor`}>{fechaLegible || "Elegir fecha"}</span>
              </button>
              <input
                ref={fechaNativa}
                type="date"
                className="rec-env-fecha-nativa"
                tabIndex={-1}
                aria-hidden
                value={activo.date ?? ""}
                onChange={(ev) => editar({ date: ev.target.value })}
              />
            </span>
          </span>
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
        {avisosGmail.map((a) => <p key={a} className="rec-mail-problema-linea" role="status">{a}</p>)}
        {esRecordatorio && plataforma === "mailchimp" ? <SincronizarRespuestas key={campana ?? ""} campana={campana} /> : null}
        <CampoDeTexto
          label="Asunto"
          valor={activo.subject ?? ""}
          placeholder="El de la plantilla"
          ayuda={ayudaDeVacio(template.subject)}
          maximo={80}
          onCambio={(subject) => editar({ subject })}
        />
        <CampoDeTexto
          label="Texto de vista previa"
          valor={activo.preheader ?? ""}
          placeholder="El de la plantilla"
          ayuda={ayudaDeVacio(template.preheader)}
          maximo={140}
          onCambio={(preheader) => editar({ preheader })}
        />
        <div
          className={`rec-env-apertura${apertura ? "" : " is-vacia"}`}
          style={{ "--rec-env-ejemplo": JSON.stringify(esRecordatorio ? EJEMPLO_DE_APERTURA : "Sin apertura") } as CSSProperties}
        >
          <CampoConCampos
            key={activo.send_id}
            label="Apertura"
            valor={apertura}
            opciones={camposDeLaApertura(template)}
            multilinea
            enlaces
            filas={3}
            normalizar={sinEspacioSuelto}
            problemas={aperturaLarga}
            ayuda="Un párrafo que sólo lleva este envío, después del saludo. Puedes usar negrita, cursiva, campos y enlaces."
            onCambio={(opening) => editar({ opening })}
          />
        </div>
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
