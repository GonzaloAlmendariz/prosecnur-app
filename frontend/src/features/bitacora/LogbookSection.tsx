import { useState } from "react";
import { Clock3, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import {
  apiBitacoraDelete,
  apiBitacoraUpsert,
  type DisenoEstudioBitacoraEntry,
  type DisenoEstudioBitacoraInput,
  type DisenoEstudioBitacoraTone,
} from "../../api/client";
import { Alert } from "../../components/Alert";

const MODULE_OPTIONS = [
  ["diseno-estudio", "Bitácora"],
  ["plan-trabajo", "Cronograma"],
  ["calc-muestra", "Muestra"],
  ["editor-xlsform", "Formulario"],
  ["hojas-ruta", "Rutas"],
  ["recopiladores", "Fichas QR"],
  ["monitoreo", "Monitoreo"],
  ["carga", "Carga"],
  ["validacion", "Validación"],
  ["codificacion", "Codificación"],
  ["analitica", "Analítica"],
  ["graficos", "Gráficos"],
  ["dashboard", "Dashboard"],
  ["proyecto", "Proyecto"],
] as const;

const TONE_OPTIONS: Array<[DisenoEstudioBitacoraTone, string]> = [
  ["nota", "Nota"],
  ["decision", "Decisión"],
  ["avance", "Avance"],
  ["riesgo", "Riesgo"],
  ["bloqueo", "Bloqueo"],
];

const EMPTY_ENTRY: DisenoEstudioBitacoraInput = {
  module_id: "diseno-estudio",
  tone: "nota",
  title: "",
  body: "",
  tags: [],
};

function moduleLabel(id: string) {
  return MODULE_OPTIONS.find(([key]) => key === id)?.[1] ?? id;
}

function toneLabel(tone: string) {
  return TONE_OPTIONS.find(([key]) => key === tone)?.[1] ?? tone;
}

function dateLabel(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function LogbookSection({
  entries,
  onChange,
}: {
  entries: DisenoEstudioBitacoraEntry[];
  onChange: (entries: DisenoEstudioBitacoraEntry[]) => void;
}) {
  const [draft, setDraft] = useState<DisenoEstudioBitacoraInput>(EMPTY_ENTRY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveEntry() {
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title && !body) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiBitacoraUpsert({ ...draft, title: title || "Nota de bitácora", body });
      onChange(res.bitacora);
      setDraft(EMPTY_ENTRY);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la bitácora.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await apiBitacoraDelete(id);
      onChange(res.bitacora);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la entrada.");
    } finally {
      setSaving(false);
    }
  }

  function editEntry(entry: DisenoEstudioBitacoraEntry) {
    setDraft({
      id: entry.id,
      module_id: entry.module_id,
      tone: entry.tone,
      title: entry.title,
      body: entry.body,
      occurred_at: entry.occurred_at,
      tags: entry.tags,
    });
  }

  return (
    <div className="diseno-bitacora-grid">
      <section className="diseno-compose">
        <div className="diseno-panel-head">
          <Pencil size={16} />
          <strong>{draft.id ? "Editar entrada" : "Nueva entrada"}</strong>
        </div>
        <div className="diseno-compose-row">
          <label>
            <span>Módulo</span>
            <select
              value={draft.module_id ?? "diseno-estudio"}
              onChange={(event) => setDraft({ ...draft, module_id: event.target.value })}
            >
              {MODULE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Tipo</span>
            <select
              value={draft.tone ?? "nota"}
              onChange={(event) => setDraft({ ...draft, tone: event.target.value as DisenoEstudioBitacoraTone })}
            >
              {TONE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span>Título</span>
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="Decisión, incidencia o avance"
          />
        </label>
        <label>
          <span>Detalle</span>
          <textarea
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            placeholder="Redacta la evidencia, el acuerdo o el contexto operativo"
            rows={8}
          />
        </label>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="diseno-compose-actions">
          {draft.id && (
            <button type="button" className="diseno-secondary-button" onClick={() => setDraft(EMPTY_ENTRY)}>
              Cancelar
            </button>
          )}
          <button
            type="button"
            className="diseno-primary-button"
            onClick={saveEntry}
            disabled={saving || (!draft.title.trim() && !draft.body.trim())}
          >
            {saving ? <Loader2 size={15} className="spin" /> : draft.id ? <Save size={15} /> : <Plus size={15} />}
            <span>{draft.id ? "Guardar edición" : "Registrar"}</span>
          </button>
        </div>
      </section>

      <section className="diseno-timeline" aria-label="Bitácora del proyecto">
        {entries.length === 0 ? (
          <div className="diseno-timeline-empty">
            <ClipboardEmptyIcon />
            <strong>Bitácora vacía</strong>
            <span>Registra decisiones, riesgos, bloqueos y avances del proyecto.</span>
          </div>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className={`diseno-timeline-item is-${entry.tone} is-manual`}>
              <div className="diseno-timeline-dot" aria-hidden="true" />
              <div className="diseno-timeline-body">
                <div className="diseno-timeline-meta">
                  <span>{moduleLabel(entry.module_id)}</span>
                  <span>{toneLabel(entry.tone)}</span>
                  {entry.occurred_at && (
                    <span><Clock3 size={12} /> {dateLabel(entry.occurred_at)}</span>
                  )}
                </div>
                <strong>{entry.title}</strong>
                <p>{entry.body}</p>
                <div className="diseno-timeline-footer">
                  <span>Bitácora del usuario</span>
                  <span className="diseno-entry-actions">
                    <button type="button" onClick={() => editEntry(entry)} title="Editar entrada">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => deleteEntry(entry.id)} title="Eliminar entrada">
                      <Trash2 size={13} />
                    </button>
                  </span>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function ClipboardEmptyIcon() {
  return <Pencil size={26} aria-hidden="true" />;
}
