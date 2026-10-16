import { useId, useState, type ChangeEvent } from "react";

import type { MailField, MailRecipients, MailRecipientsMapping, MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { FileUp, Plus, ShieldCheck, Trash2, Users } from "../../../vendor/lucide-react";
import { Segmented } from "../../xlsformEditor/kit";
import { nuevoCampo, problemaDeCampo, CUERPO_DEL_INSPECTOR } from "./modeloCorreo";

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
};

const SIN_COLUMNA = "";

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
  onCambiar,
  onQuitar,
  onColumna,
}: {
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
        <span className="rec-mail-token">{`{{${field.key}}}`}</span>
        <span className="rec-mail-flecha" aria-hidden>→</span>
        <input
          className="rec-mail-input rec-mail-input--sm is-mono rec-mail-input--tag"
          aria-label={`Etiqueta de Mailchimp de ${field.label}`}
          value={field.tag}
          maxLength={10}
          onChange={(e) => onCambiar({ ...field, tag: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })}
        />
        <PulsoButton variant="icon" size="sm" aria-label={`Quitar el campo ${field.label}`} title="Quitar" onClick={onQuitar}>
          <Trash2 size={13} aria-hidden />
        </PulsoButton>
      </span>
      <span className="rec-mail-def-campo-datos">
        <input
          className="rec-mail-input rec-mail-input--sm"
          aria-label={`Rótulo de {{${field.key}}}`}
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
}: Props) {
  const [nuevo, setNuevo] = useState("");
  const cargados = Boolean(destinatarios?.loaded);
  const mapping = destinatarios?.mapping ?? null;
  const columnas = destinatarios?.columns ?? [];
  const counts = destinatarios?.counts ?? null;
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
            data-qa-geometry-group="material-campo/catalogo/correos-personas"
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
            <ShieldCheck size={13} aria-hidden /> Los correos se ven solo en la audiencia exportada para Mailchimp;
            aquí se muestran nombre y campos. La lista vive en esta sesión y no entra al proyecto.
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
          <p>Sin destinatarios, la vista previa usa una persona de ejemplo y la audiencia no se puede exportar.</p>
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
          data-qa-geometry-group="material-campo/catalogo/correos-campos"
          data-qa-geometry-contract="intrinsic"
        >
          <li className="rec-mail-def-campo rec-mail-def-campo--fijo">
            <span className="rec-mail-def-campo-tags">
              <span className="rec-mail-token">{"{{nombre}}"}</span>
              <span className="rec-mail-flecha" aria-hidden>→</span>
              <span className="xfk-mono">FNAME</span>
            </span>
            <span className="rec-mail-ayuda">El nombre de pila, del mapeo de arriba. Reservado.</span>
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
