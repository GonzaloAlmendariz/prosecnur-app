import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from "../../vendor/lucide-react";
import {
  ApiError,
  apiCargaProcessingIntake,
  apiCargaProcessingIntakeSave,
  apiCargaProcessingIntakeValidate,
  type EstudioProcessingSuggestionGroup,
  type ProcessingIntakeBindingInput,
  type ProcessingIntakePayload,
} from "../../api/client";
import {
  newProcessingIntakeBinding,
  processingIntakeBindingFingerprint,
  processingIntakeBindingInput,
  processingIntakeDraftValid,
  processingIntakeEntryFormId,
  processingIntakeResolvedEntry,
  processingIntakeRevisionLabel,
  processingIntakeStatusView,
  processingIntakeSuggestedGroups,
} from "./processingIntakeModel";

type Props = {
  sessionId: string | null;
  suggestions?: EstudioProcessingSuggestionGroup[];
};

function newEntryId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `intake-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function draftSignature(entries: ProcessingIntakeBindingInput[]): string {
  return entries.map(processingIntakeBindingFingerprint).join("|");
}

export function ProcessingIntakePanel({ sessionId, suggestions = [] }: Props) {
  const [payload, setPayload] = useState<ProcessingIntakePayload | null>(null);
  const [draft, setDraft] = useState<ProcessingIntakeBindingInput[]>([]);
  const [validated, setValidated] = useState<ProcessingIntakePayload | null>(null);
  const [conflictServer, setConflictServer] = useState<ProcessingIntakePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "validate" | "save" | "reload">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const applyServerPayload = useCallback((next: ProcessingIntakePayload) => {
    setPayload(next);
    setDraft(next.intake.entries.map(processingIntakeBindingInput));
    setValidated(next);
    setConflictServer(null);
    setError("");
  }, []);

  const load = useCallback(async (discardDraft = false) => {
    setBusy("reload");
    setError("");
    try {
      const next = await apiCargaProcessingIntake();
      if (discardDraft || !payload) applyServerPayload(next);
      else setConflictServer(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo leer el plan de ingreso.");
    } finally {
      setBusy("");
      setLoading(false);
    }
  }, [applyServerPayload, payload]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setMessage("");
    setPayload(null);
    setValidated(null);
    setConflictServer(null);
    void apiCargaProcessingIntake()
      .then((next) => {
        if (cancelled) return;
        applyServerPayload(next);
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "No se pudo leer el plan de ingreso.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sessionId, applyServerPayload]);

  const persistedDraft = useMemo(
    () => payload?.intake.entries.map(processingIntakeBindingInput) ?? [],
    [payload],
  );
  const dirty = draftSignature(draft) !== draftSignature(persistedDraft);
  const locallyValid = processingIntakeDraftValid(draft);
  const revisions = conflictServer?.revisions ?? payload?.revisions ?? [];
  const remainingSuggestions = processingIntakeSuggestedGroups(suggestions, draft);

  function updateEntry(entryId: string, patch: Partial<ProcessingIntakeBindingInput>) {
    setDraft((current) => current.map((entry) => (
      entry.entry_id === entryId ? { ...entry, ...patch } : entry
    )));
    setValidated(null);
    setMessage("");
  }

  function addEntry(suggestion?: EstudioProcessingSuggestionGroup) {
    setDraft((current) => [
      ...current,
      newProcessingIntakeBinding(newEntryId(), suggestion),
    ]);
    setValidated(null);
    setMessage("");
  }

  async function validateDraft() {
    if (!payload || !locallyValid) {
      setError("Completa actor, base y revisión publicada antes de validar.");
      return;
    }
    setBusy("validate");
    setError("");
    setMessage("");
    try {
      const result = await apiCargaProcessingIntakeValidate({
        expected_revision: payload.intake.revision,
        entries: draft,
      });
      setValidated(result);
      setMessage(result.validation.valid
        ? "Plan validado. Los instrumentos están listos para recibir datos."
        : "La validación encontró entradas que requieren revisión.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo validar el plan.");
    } finally {
      setBusy("");
    }
  }

  async function saveDraft() {
    if (!payload || !locallyValid) {
      setError("Completa actor, base y revisión publicada antes de guardar.");
      return;
    }
    setBusy("save");
    setError("");
    setMessage("");
    try {
      const result = await apiCargaProcessingIntakeSave({
        expected_revision: payload.intake.revision,
        entries: draft,
      });
      applyServerPayload(result);
      setMessage(`Plan guardado en revisión ${result.intake.revision}.`);
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "E_PROCESSING_INTAKE_STALE") {
        setError("El plan cambió en otra pantalla. Conservamos tu borrador; revisa la versión actual antes de decidir.");
        try {
          setConflictServer(await apiCargaProcessingIntake());
        } catch {
          // El error original y el borrador local siguen visibles.
        }
      } else {
        setError(reason instanceof Error ? reason.message : "No se pudo guardar el plan.");
      }
    } finally {
      setBusy("");
    }
  }

  if (loading && !payload) {
    return (
      <section className="pulso-processing-intake is-loading" aria-label="Plan de ingreso de instrumentos">
        <Loader2 size={17} className="pulso-spin" aria-hidden="true" />
        <span>Leyendo instrumentos publicados…</span>
      </section>
    );
  }

  return (
    <section
      className="pulso-processing-intake"
      aria-label="Plan de ingreso de instrumentos"
      data-audit-ready="true"
    >
      <header className="pulso-processing-intake-head">
        <span className="pulso-processing-intake-icon" aria-hidden="true">
          <FileSpreadsheet size={18} />
        </span>
        <div className="pulso-processing-intake-copy">
          <span className="pulso-processing-intake-kicker">Instrumentos publicados</span>
          <strong>Plan de ingreso por actor</strong>
          <p>Fija una revisión por actor ahora. Las bases se crearán solo cuando Monitoreo entregue datos compatibles.</p>
        </div>
        <span className="pulso-processing-intake-revision">
          rev. {payload?.intake.revision ?? 0}
        </span>
      </header>

      {(error || message) && (
        <div className={`pulso-processing-intake-feedback${error ? " is-error" : " is-success"}`} role="status">
          {error ? <AlertTriangle size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
          <span>{error || message}</span>
        </div>
      )}

      {conflictServer && (
        <div className="pulso-processing-intake-conflict" role="alert">
          <div>
            <strong>Versión del proyecto: rev. {conflictServer.intake.revision}</strong>
            <span>Tu borrador continúa intacto y no se sobrescribió.</span>
          </div>
          <button type="button" onClick={() => applyServerPayload(conflictServer)}>
            Descartar borrador y cargar proyecto
          </button>
        </div>
      )}

      {remainingSuggestions.length > 0 && (
        <div className="pulso-processing-intake-suggestions" aria-label="Actores sugeridos por Monitoreo">
          <span>Desde Monitoreo</span>
          {remainingSuggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion.actor_key}
              onClick={() => addEntry(suggestion)}
              disabled={!!busy}
            >
              <Plus size={12} aria-hidden="true" />
              {suggestion.actor}
            </button>
          ))}
        </div>
      )}

      <div className="pulso-processing-intake-list" role="list">
        {draft.map((entry) => {
          const resolved = processingIntakeResolvedEntry(
            entry,
            validated?.validation.entries ?? [],
            payload?.intake.entries ?? [],
          );
          const status = resolved ? processingIntakeStatusView(resolved.status) : null;
          const formId = processingIntakeEntryFormId(resolved, revisions, entry.instrument_revision_id);
          return (
            <article className="pulso-processing-intake-row" role="listitem" key={entry.entry_id}>
              <div className="pulso-processing-intake-fields">
                <label>
                  <span>Actor</span>
                  <input
                    value={entry.actor}
                    onChange={(event) => updateEntry(entry.entry_id, { actor: event.target.value })}
                    disabled={!!busy}
                  />
                </label>
                <label>
                  <span>Base futura</span>
                  <input
                    value={entry.base_label}
                    onChange={(event) => updateEntry(entry.entry_id, { base_label: event.target.value })}
                    disabled={!!busy}
                  />
                </label>
                <label className="pulso-processing-intake-revision-field">
                  <span>Revisión publicada</span>
                  <select
                    value={entry.instrument_revision_id}
                    onChange={(event) => updateEntry(entry.entry_id, { instrument_revision_id: event.target.value })}
                    disabled={!!busy || revisions.length === 0}
                  >
                    <option value="">Selecciona un instrumento…</option>
                    {revisions.map((revision) => (
                      <option
                        value={revision.revision_id}
                        key={revision.revision_id}
                        disabled={!revision.available}
                      >
                        {processingIntakeRevisionLabel(revision)}{revision.available ? "" : " · no disponible"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="pulso-processing-intake-row-meta">
                <span className="pulso-processing-intake-machine-key" title="Identidad técnica estable">
                  {entry.base}
                </span>
                {status ? (
                  <span className={`pulso-processing-intake-status is-${status.tone}`} title={status.detail}>
                    {status.label}
                  </span>
                ) : (
                  <span className="pulso-processing-intake-status is-info">Pendiente de validar</span>
                )}
                {resolved?.blocking_reasons?.[0] && (
                  <span className="pulso-processing-intake-reason">{resolved.blocking_reasons[0].message}</span>
                )}
                {formId ? (
                  <Link to={`/editor-xlsform?form_id=${encodeURIComponent(formId)}`}>
                    Abrir en Editor <ExternalLink size={12} aria-hidden="true" />
                  </Link>
                ) : (
                  <Link to="/editor-xlsform">Publicar en Editor <ExternalLink size={12} aria-hidden="true" /></Link>
                )}
                <button
                  type="button"
                  className="pulso-processing-intake-remove"
                  aria-label={`Quitar actor ${entry.actor}`}
                  title="Quitar del plan; no elimina el formulario"
                  disabled={!!busy}
                  onClick={() => {
                    setDraft((current) => current.filter((item) => item.entry_id !== entry.entry_id));
                    setValidated(null);
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {draft.length === 0 && (
        <div className="pulso-processing-intake-empty">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>Aún no hay actores vinculados</strong>
            <span>{revisions.length > 0
              ? "Agrega un actor y elige una revisión publicada."
              : "Publica primero uno o más formularios desde el Editor XLSForm."}</span>
          </div>
          {revisions.length === 0 && <Link to="/editor-xlsform">Ir al Editor</Link>}
        </div>
      )}

      <footer className="pulso-processing-intake-actions">
        <button
          type="button"
          onClick={() => addEntry()}
          disabled={!!busy || draft.length >= (payload?.validation.max_entries ?? 10)}
        >
          <Plus size={14} aria-hidden="true" /> Agregar actor
        </button>
        <span className="pulso-processing-intake-action-spacer" />
        <button
          type="button"
          onClick={() => {
            if (!dirty || window.confirm("¿Descartar los cambios locales y volver a cargar el plan guardado?")) {
              void load(true);
            }
          }}
          disabled={!!busy}
        >
          <RefreshCw size={14} className={busy === "reload" ? "pulso-spin" : ""} aria-hidden="true" />
          Recargar
        </button>
        <button type="button" onClick={() => void validateDraft()} disabled={!!busy || !locallyValid || draft.length === 0}>
          {busy === "validate" ? <Loader2 size={14} className="pulso-spin" /> : <ShieldCheck size={14} />}
          Validar
        </button>
        <button
          type="button"
          className="is-primary"
          onClick={() => void saveDraft()}
          disabled={!!busy || !dirty || !locallyValid || !!conflictServer}
        >
          {busy === "save" ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
          Guardar plan
        </button>
      </footer>
    </section>
  );
}
