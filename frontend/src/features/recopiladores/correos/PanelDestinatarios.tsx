import { useId, useState, type ChangeEvent } from "react";

import type { MailField, MailPlatform, MailRecipients, MailRecipientsMapping, MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { ArrowRight, FileUp, Plus, ShieldCheck, Sparkles, Trash2, Users } from "../../../vendor/lucide-react";
import { Segmented } from "../../xlsformEditor/kit";
import { NOMBRE_DE_PLATAFORMA } from "./dialectos";
import { notasDeLectura, nuevoCampo, problemaDeCampo, CUERPO_DEL_INSPECTOR } from "./modeloCorreo";
import type { OfertaDelTrato } from "./modeloTrato";
import { DestinatariosEnSurveyMonkey, MapeoSurveyMonkey } from "./PanelSurveyMonkey";
import "./correosPersonas.css";

type Props = {
  template: MailTemplate;
  destinatarios: MailRecipients | null;
  persona: number | null;
  ocupado: boolean;
  onEditar: (update: (t: MailTemplate) => MailTemplate) => void;
  onImportar: (file: File) => void;
  onMapear: (mapping: MailRecipientsMapping) => void;
  onOlvidar: () => void;
  onVerComo: (index: number) => void;
  /** La plataforma de la campaña: Personas habla su dialecto (F5). */
  dialecto?: MailPlatform;
  /** El saludo por sexo, ofrecido donde se carga la lista (F2). */
  oferta?: OfertaDelTrato;
  onUsarColumnaDeSexo?: (columna: string) => void;
  onVerSaludo?: () => void;
};

const SIN_COLUMNA = "";

/** Lo que Personas dice según la plataforma: dónde viajan los correos y qué falta sin lista. */
const TEXTO_DE_PERSONAS: Record<MailPlatform, { nota: string; sinLista: string }> = {
  mailchimp: {
    nota: "Los correos se ven solo en la audiencia exportada para Mailchimp; aquí se muestran nombre y campos. La lista vive en esta sesión y no entra al proyecto.",
    sinLista: "Sin destinatarios, la vista previa usa una persona de ejemplo y la audiencia no se puede exportar.",
  },
  surveymonkey: {
    nota: "Los correos sólo van en contactos_surveymonkey.csv, dentro del paquete; aquí se muestran nombre y campos. La lista vive en esta sesión y no entra al proyecto.",
    sinLista: "Sin lista, la vista previa usa una persona de ejemplo y el paquete sale sin el archivo de contactos.",
  },
};

/** Lo que identifica a la persona en la muestra: sus campos, sin enlaces. */
function datosDePersona(template: MailTemplate, fields: Record<string, string>): string {
  return template.fields
    .map((f) => fields[f.key] ?? "")
    .filter((v) => v && !/^(https?:|mailto:)/i.test(v))
    .join(" · ");
}

function SelectorDeColumna({
  label,
  value,
  columnas,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  columnas: readonly string[];
  disabled: boolean;
  onChange: (columna: string | null) => void;
}) {
  return (
    <select
      className="rec-mail-select"
      aria-label={label}
      value={value ?? SIN_COLUMNA}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value={SIN_COLUMNA}>Sin columna</option>
      {columnas.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

function ImportarArchivo({ etiqueta, disabled, onArchivo, primario }: { etiqueta: string; disabled: boolean; onArchivo: (f: File) => void; primario?: boolean }) {
  const id = useId();
  const alElegir = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onArchivo(file);
  };
  return (
    <span className={`rec-mail-subir${disabled ? " is-disabled" : ""}`}>
      <input
        id={id}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="pulso-sr-only"
        disabled={disabled}
        onChange={alElegir}
      />
      <label htmlFor={id} className={`pulso-button pulso-button--${primario ? "primary" : "secondary"} pulso-button--sm`}>
        <FileUp size={14} aria-hidden /> {etiqueta}
      </label>
    </span>
  );
}

function FilaDeCampo({
  field,
  otros,
  columna,
  columnas,
  cargados,
  ocupado,
  dialecto,
  onCambiar,
  onQuitar,
  onColumna,
}: {
  dialecto: MailPlatform;
  field: MailField;
  otros: readonly MailField[];
  columna: string | null;
  columnas: readonly string[];
  cargados: boolean;
  ocupado: boolean;
  onCambiar: (field: MailField) => void;
  onQuitar: () => void;
  onColumna: (columna: string | null) => void;
}) {
  const problema = problemaDeCampo(field, otros);
  return (
    <li className="rec-mail-def-campo">
      <span className="rec-mail-def-campo-tags">
        <span className="rec-mail-def-campo-nombre" title={`${field.label || field.key}: cambia con cada persona`}>{field.label || field.key}</span>
        {dialecto === "mailchimp" ? (
          <>
            <span className="rec-mail-def-campo-plataforma" aria-hidden>en Mailchimp</span>
            <input
              className="rec-mail-input rec-mail-input--sm is-mono rec-mail-input--tag"
              aria-label={`Etiqueta de Mailchimp de ${field.label}`}
              value={field.tag}
              maxLength={10}
              onChange={(e) => onCambiar({ ...field, tag: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })}
            />
          </>
        ) : (
          // En SurveyMonkey la etiqueta se elige abajo, en «Para SurveyMonkey».
          <span className="rec-mail-def-campo-sm xfk-mono">{field.sm ? `[${field.sm}]` : "sin etiqueta"}</span>
        )}
        <PulsoButton variant="icon" size="sm" aria-label={`Quitar el campo ${field.label}`} title="Quitar" onClick={onQuitar}>
          <Trash2 size={13} aria-hidden />
        </PulsoButton>
      </span>
      <span className="rec-mail-def-campo-datos">
        <input
          className="rec-mail-input rec-mail-input--sm"
          aria-label={`Nombre del campo ${field.label || field.key}`}
          value={field.label}
          onChange={(e) => onCambiar({ ...field, label: e.target.value })}
        />
        <input
          className="rec-mail-input rec-mail-input--sm"
          aria-label={`Si falta el dato de ${field.label}`}
          placeholder="Si falta el dato…"
          value={field.fallback ?? ""}
          onChange={(e) => {
            const { fallback: _f, ...resto } = field;
            void _f;
            onCambiar(e.target.value ? { ...resto, fallback: e.target.value } : resto);
          }}
        />
        {cargados ? (
          <SelectorDeColumna
            label={`Columna de ${field.label}`}
            value={columna}
            columnas={columnas}
            disabled={ocupado}
            onChange={onColumna}
          />
        ) : null}
      </span>
      {problema ? <span className="rec-mail-problema-linea" role="status">{problema}</span> : null}
    </li>
  );
}

/** Pestaña «Destinatarios»: los campos de cada persona y la lista que los llena. */
export function PanelDestinatarios({
  template,
  destinatarios,
  persona,
  ocupado,
  onEditar,
  onImportar,
  onMapear,
  onOlvidar,
  onVerComo,
  dialecto = "mailchimp",
  oferta = null,
  onUsarColumnaDeSexo,
  onVerSaludo,
}: Props) {
  const [nuevo, setNuevo] = useState("");
  const texto = TEXTO_DE_PERSONAS[dialecto];
  const cargados = Boolean(destinatarios?.loaded);
  const mapping = destinatarios?.mapping ?? null;
  const columnas = destinatarios?.columns ?? [];
  const counts = destinatarios?.counts ?? null;
  const notas = notasDeLectura(destinatarios?.encoding ?? null, counts);
  const fuera = counts ? counts.without_email + counts.invalid_email + counts.duplicated : 0;

  const cambiarMapeo = (patch: Partial<MailRecipientsMapping>) => {
    if (!mapping) return;
    onMapear({ ...mapping, ...patch });
  };

  const agregarCampo = () => {
    if (!nuevo.trim()) return;
    const field = nuevoCampo(nuevo, template.fields);
    onEditar((t) => ({ ...t, fields: [...t.fields, field] }));
    setNuevo("");
  };

  return (
    <div {...CUERPO_DEL_INSPECTOR} className="rec-mail-insp-cuerpo">
      {dialecto === "surveymonkey" && !cargados ? <DestinatariosEnSurveyMonkey /> : null}
      <div className="rec-mail-insp-cabeza">
        <h3>{cargados && counts ? `${counts.valid.toLocaleString("es-PE")} destinatarios` : "Destinatarios"}</h3>
        <p>
          {cargados && destinatarios?.file_name
            ? `de ${destinatarios.file_name}`
            : "La lista con el correo y los datos de cada persona, en CSV o XLSX."}
        </p>
      </div>

      {cargados && counts ? (
        <>
          <p className="rec-mail-cuentas">
            {counts.total.toLocaleString("es-PE")} filas
            {fuera ? ` · quedan fuera ${[
              counts.without_email ? `${counts.without_email} sin correo` : "",
              counts.invalid_email ? `${counts.invalid_email} con correo inválido` : "",
              counts.duplicated ? `${counts.duplicated} ${counts.duplicated === 1 ? "repetido" : "repetidos"}` : "",
            ].filter(Boolean).join(", ")}` : " · todas con correo válido"}
          </p>
          {notas.length ? <p className="rec-mail-ayuda">{notas.join(" · ")}</p> : null}
          {oferta?.tipo === "ofrecer" && onUsarColumnaDeSexo ? (
            <div className="rec-personas-trato" role="group" aria-label="Saludo según el sexo">
              <Sparkles size={14} aria-hidden />
              <span>La lista trae «{oferta.columna}»: el saludo puede decir Estimado o Estimada según cada persona.</span>
              <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={() => onUsarColumnaDeSexo(oferta.columna)}>
                Usar «{oferta.columna}» para el saludo
              </PulsoButton>
            </div>
          ) : null}
          {oferta?.tipo === "en-uso" ? (
            <p className="rec-personas-trato is-en-uso" role="status">
              <span>El saludo cambia según «{oferta.columna}».</span>
              {onVerSaludo ? (
                <button type="button" className="rec-mail-link" onClick={onVerSaludo}>
                  Ver el saludo <ArrowRight size={12} aria-hidden />
                </button>
              ) : null}
            </p>
          ) : null}
          <div className="rec-mail-mapeo">
            <label className="rec-mail-mapeo-fila">
              <span>Correo</span>
              <SelectorDeColumna
                label="Columna del correo"
                value={mapping?.email_column ?? null}
                columnas={columnas}
                disabled={ocupado}
                onChange={(email_column) => cambiarMapeo({ email_column })}
              />
            </label>
            <label className="rec-mail-mapeo-fila">
              <span>Nombre</span>
              <SelectorDeColumna
                label="Columna del nombre"
                value={mapping?.name_column ?? null}
                columnas={columnas}
                disabled={ocupado}
                onChange={(name_column) => cambiarMapeo({ name_column })}
              />
            </label>
            <div className="rec-mail-mapeo-fila">
              <span>Formato</span>
              <Segmented
                aria-label="Formato del nombre"
                size="sm"
                value={mapping?.name_format ?? "nombre"}
                options={[
                  { value: "nombre", label: "Nombre" },
                  { value: "apellidos_coma_nombres", label: "Apellidos, Nombres" },
                ]}
                onChange={(name_format) => cambiarMapeo({ name_format })}
              />
            </div>
          </div>
          <ul
            className="rec-mail-personas"
            aria-label="Muestra de destinatarios"
            data-qa-geometry-group="material-campo/correo/personas"
            data-qa-geometry-contract="equal"
          >
            {destinatarios!.sample.map((p) => (
              <li key={p.index}>
                <button
                  type="button"
                  className={`rec-mail-persona${persona === p.index ? " is-active" : ""}`}
                  aria-pressed={persona === p.index}
                  onClick={() => onVerComo(p.index)}
                >
                  <span className="rec-mail-persona-nombre">
                    <b>{p.nombre || "Sin nombre"}</b>
                    <span>{datosDePersona(template, p.fields) || "Sin campos con dato"}</span>
                  </span>
                  <span className="rec-mail-persona-n">{p.index}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="rec-mail-nota">
            <ShieldCheck size={13} aria-hidden /> {texto.nota}
          </p>
          <span className="rec-mail-botones">
            <ImportarArchivo etiqueta="Cambiar la lista" disabled={ocupado} onArchivo={onImportar} />
            <PulsoButton variant="ghost" size="sm" disabled={ocupado} onClick={onOlvidar}>
              <Trash2 size={14} aria-hidden /> Olvidar la lista
            </PulsoButton>
          </span>
        </>
      ) : (
        <div className="rec-mail-sin-lista" data-qa-geometry-capacity="owned">
          <Users size={18} aria-hidden />
          <p>{texto.sinLista}</p>
          <ImportarArchivo etiqueta="Importar destinatarios" primario disabled={ocupado} onArchivo={onImportar} />
          <span className="rec-mail-ayuda">
            Una fila por persona con su correo; el nombre y los campos se eligen después. Los correos no se muestran aquí ni entran al proyecto.
          </span>
        </div>
      )}

      <section className="rec-mail-definiciones" aria-label="Campos de cada persona">
        <span className="xfk-over">Campos de cada persona</span>
        <ul
          className="rec-mail-def-campos"
          data-qa-geometry-group="material-campo/correo/campos"
          data-qa-geometry-contract="intrinsic"
        >
          <li className="rec-mail-def-campo rec-mail-def-campo--fijo">
            <span className="rec-mail-def-campo-tags">
              <span className="rec-mail-def-campo-nombre" title="Nombre: cambia con cada persona">Nombre</span>
            </span>
            {/* #12: sólo con lista hay una columna de nombre elegida arriba. */}
            {cargados ? <span className="rec-mail-ayuda">Sale de la columna de nombre que elegiste arriba.</span> : null}
          </li>
          {template.fields.map((field, i) => (
            <FilaDeCampo
              key={`${field.key}-${i}`}
              field={field}
              otros={template.fields.filter((_, j) => j !== i)}
              columna={mapping?.fields[field.key] ?? null}
              columnas={columnas}
              cargados={cargados}
              ocupado={ocupado}
              dialecto={dialecto}
              onCambiar={(next) => onEditar((t) => ({ ...t, fields: t.fields.map((f, j) => (j === i ? next : f)) }))}
              onQuitar={() => onEditar((t) => ({ ...t, fields: t.fields.filter((_, j) => j !== i) }))}
              onColumna={(columna) => {
                if (!mapping) return;
                const fields = { ...mapping.fields };
                if (columna) fields[field.key] = columna;
                else delete fields[field.key];
                onMapear({ ...mapping, fields });
              }}
            />
          ))}
        </ul>
        {dialecto === "surveymonkey" ? (
          <div className="rec-personas-sm">
            <span className="xfk-over">Para {NOMBRE_DE_PLATAFORMA.surveymonkey}</span>
            <span className="rec-mail-ayuda">Cada campo va en una etiqueta del recopilador.</span>
            <MapeoSurveyMonkey template={template} onEditar={onEditar} />
          </div>
        ) : null}
        <form
          className="rec-mail-nuevo-campo"
          onSubmit={(e) => { e.preventDefault(); agregarCampo(); }}
        >
          <input
            className="rec-mail-input rec-mail-input--sm"
            aria-label="Rótulo del campo nuevo"
            placeholder="Campo nuevo (p. ej. Aula)"
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
          />
          <PulsoButton variant="secondary" size="sm" type="submit" disabled={!nuevo.trim()}>
            <Plus size={14} aria-hidden /> Agregar
          </PulsoButton>
        </form>
      </section>
    </div>
  );
}
