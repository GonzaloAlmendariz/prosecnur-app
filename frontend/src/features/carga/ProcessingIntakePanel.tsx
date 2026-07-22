import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  processingIntakeEntriesFromGuidedPlan,
  processingIntakeEntryFormId,
  processingIntakeGuidedPlan,
  processingIntakePlanComplete,
  processingIntakeResolvedEntry,
  processingIntakeRevisionLabel,
  processingIntakeStatusView,
  processingIntakeSuggestedGroups,
  type ProcessingIntakeGuidedPlan,
} from "./processingIntakeModel";

type Props = {
  sessionId: string | null;
  suggestions?: EstudioProcessingSuggestionGroup[];
  onPlanSaved?: () => void;
};

type PendingFocus =
  | { kind: "actor"; key: string }
  | { kind: "suggestion"; key: string }
  | null;

function newEntryId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `intake-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function draftSignature(entries: ProcessingIntakeBindingInput[]): string {
  return entries.map(processingIntakeBindingFingerprint).join("|");
}

export function ProcessingIntakePanel({ sessionId, suggestions = [], onPlanSaved }: Props) {
  const [payload, setPayload] = useState<ProcessingIntakePayload | null>(null);
  const [draft, setDraft] = useState<ProcessingIntakeBindingInput[]>([]);
  const [validated, setValidated] = useState<ProcessingIntakePayload | null>(null);
  const [conflictServer, setConflictServer] = useState<ProcessingIntakePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "validate" | "save" | "reload">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [guidedPlan, setGuidedPlan] = useState<ProcessingIntakeGuidedPlan | null>(null);
  const [pendingFocus, setPendingFocus] = useState<PendingFocus>(null);
  const actorInputRefs = useRef(new Map<string, HTMLInputElement>());
  const suggestionButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const addActorButtonRef = useRef<HTMLButtonElement>(null);

  const applyServerPayload = useCallback((next: ProcessingIntakePayload) => {
    setPayload(next);
    setDraft(next.intake.entries.map(processingIntakeBindingInput));
    setValidated(next);
    setConflictServer(null);
    setError("");
    setGuidedPlan(null);
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
    setGuidedPlan(null);
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
  const planComplete = processingIntakePlanComplete(payload?.intake.entries ?? [], suggestions);

  useEffect(() => {
    if (!pendingFocus) return;
    const target = pendingFocus.kind === "actor"
      ? actorInputRefs.current.get(pendingFocus.key)
      : suggestionButtonRefs.current.get(pendingFocus.key) ?? addActorButtonRef.current;
    if (!target) return;
    target.focus();
    setPendingFocus(null);
  }, [draft, pendingFocus, remainingSuggestions]);

  function updateEntry(entryId: string, patch: Partial<ProcessingIntakeBindingInput>) {
    setDraft((current) => current.map((entry) => (
      entry.entry_id === entryId ? { ...entry, ...patch } : entry
    )));
    setValidated(null);
    setGuidedPlan(null);
    setMessage("");
  }

  function addEntry(suggestion?: EstudioProcessingSuggestionGroup) {
    const entryId = newEntryId();
    setDraft((current) => [
      ...current,
      newProcessingIntakeBinding(entryId, suggestion),
    ]);
    setValidated(null);
    setGuidedPlan(null);
    setMessage("");
    setPendingFocus({ kind: "actor", key: entryId });
  }

  function removeEntry(entry: ProcessingIntakeBindingInput) {
    if (busy) return;
    setDraft((current) => current.filter((item) => item.entry_id !== entry.entry_id));
    setValidated(null);
    setGuidedPlan(null);
    setMessage("");
    setPendingFocus({ kind: "suggestion", key: entry.actor_key });
  }

  function prepareGuidedPlan() {
    const plan = processingIntakeGuidedPlan(suggestions, revisions);
    setGuidedPlan(plan);
    setError("");
    setMessage("");
    if (plan.ready) {
      setDraft(processingIntakeEntriesFromGuidedPlan(plan, draft, newEntryId));
      setValidated(null);
    }
  }

  async function validateDraft() {
    if (!payload || !locallyValid) {
      setError("Completa el público, el nombre de la base y el formulario publicado antes de validar.");
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
      setError("Completa el público, el nombre de la base y el formulario publicado antes de guardar.");
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
      setMessage("Asignaciones guardadas. Ya puedes actualizar las encuestas efectivas.");
      onPlanSaved?.();
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

  const guidedUnavailable = Boolean(busy || suggestions.length === 0 || revisions.length === 0);
  const guidedReason = busy
    ? "Espera a que termine la acción actual."
    : suggestions.length === 0 && revisions.length === 0
      ? "Disponible cuando Monitoreo identifique públicos y exista al menos un formulario publicado."
      : suggestions.length === 0
        ? "Disponible cuando Monitoreo identifique al menos un público."
        : revisions.length === 0
          ? "No hay revisiones publicadas. Si el instrumento ya existe, confirma su lógica y luego publícalo en el Editor."
          : "Solo propone asignaciones explícitas y no guarda el plan ni crea bases.";
  const maxEntries = payload?.validation.max_entries ?? 10;
  const addUnavailable = Boolean(busy || draft.length >= maxEntries);
  const validateUnavailable = Boolean(busy || !locallyValid || draft.length === 0);
  const saveUnavailable = Boolean(busy || !dirty || !locallyValid || conflictServer);
  const actionGuidance = busy
    ? "Espera a que termine la acción actual."
    : planComplete
      ? "Plan completo: los instrumentos están vinculados y las bases ya fueron creadas."
    : conflictServer
      ? "Revisa la versión más reciente del proyecto antes de guardar."
      : draft.length === 0
        ? "Agrega un público desde Monitoreo o de forma manual para comenzar."
        : !locallyValid
          ? "Completa los campos marcados como obligatorios para continuar."
          : dirty
            ? "Siguiente paso: guarda las asignaciones. Validar antes es opcional."
            : "Las asignaciones están guardadas. Ya puedes actualizar las encuestas efectivas.";

  return (
    <section
      id="processing-intake-plan"
      className="pulso-processing-intake"
      aria-labelledby="processing-intake-heading"
      data-audit-ready="true"
    >
      <header className="pulso-processing-intake-head">
        <span className="pulso-processing-intake-icon" aria-hidden="true">
          <FileSpreadsheet size={18} />
        </span>
        <div className="pulso-processing-intake-copy">
          <span className="pulso-processing-intake-kicker">Instrumentos publicados</span>
          <h2 id="processing-intake-heading" tabIndex={-1}>Asignar un formulario a cada público</h2>
          <p>Cada público tendrá su propia base y recibirá únicamente las encuestas efectivas incluidas por Monitoreo.</p>
        </div>
        <details className="pulso-processing-intake-plan-details">
          <summary>Detalles técnicos</summary>
          <span>Revisión del plan: {payload?.intake.revision ?? 0}</span>
        </details>
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
            <strong>Hay una versión más reciente de las asignaciones</strong>
            <span>Tu borrador continúa intacto y no se sobrescribió.</span>
            <details>
              <summary>Detalles técnicos</summary>
              <span>Revisión guardada: {conflictServer.intake.revision}</span>
            </details>
          </div>
          <button type="button" onClick={() => applyServerPayload(conflictServer)}>
            Descartar borrador y cargar proyecto
          </button>
        </div>
      )}

      {planComplete && (
        <div className="pulso-processing-intake-complete" role="status">
          <span className="pulso-processing-intake-status is-ready">
            <CheckCircle2 size={14} aria-hidden="true" /> Plan completo
          </span>
          <div>
            <h3>Bases e instrumentos listos</h3>
            <span>Las asignaciones están guardadas y las bases ya fueron creadas con sus revisiones publicadas.</span>
          </div>
        </div>
      )}

      {!planComplete && (
      <div className="pulso-processing-intake-guided" aria-labelledby="processing-intake-guide-heading">
        <div className="pulso-processing-intake-guided-copy">
          <h3 id="processing-intake-guide-heading">Completa las asignaciones</h3>
          <span>Podemos proponer coincidencias seguras o puedes agregar cada público y elegir su formulario.</span>
          <span id="processing-intake-guided-reason" className="pulso-processing-intake-help">{guidedReason}</span>
        </div>
        <div className="pulso-processing-intake-guided-actions">
          {revisions.length === 0 && (
            <Link to="/editor-xlsform" className="pulso-processing-intake-editor-link">
              Abrir Editor de formularios <ExternalLink size={12} aria-hidden="true" />
            </Link>
          )}
          <button
            type="button"
            className={!dirty ? "is-primary" : undefined}
            onClick={() => { if (!guidedUnavailable) prepareGuidedPlan(); }}
            aria-disabled={guidedUnavailable}
            aria-describedby="processing-intake-guided-reason"
          >
            <ShieldCheck size={14} aria-hidden="true" /> Completar con coincidencias seguras
          </button>
        </div>
      </div>
      )}

      {guidedPlan && (
        <div className={`pulso-processing-intake-guided-result${guidedPlan.ready ? " is-ready" : " is-blocked"}`} role="status">
          <strong>{guidedPlan.ready
            ? `${guidedPlan.links.length} asignación${guidedPlan.links.length === 1 ? "" : "es"} lista${guidedPlan.links.length === 1 ? "" : "s"}`
            : "Hay asignaciones que necesitan revisión"}</strong>
          <ul>
            {guidedPlan.links.map((link) => (
              <li key={link.actor_key} className={`is-${link.status}`}>
                {link.status === "ready" ? <CheckCircle2 size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />}
                <span>
                  <b>{link.actor}</b> · {link.status === "ready" && link.revision
                    ? `Asignado al formulario ${link.revision.form_name || link.revision.form_id}.`
                    : link.detail}
                </span>
                {link.status !== "ready" && <Link to="/editor-xlsform">Corregir en Editor <ExternalLink size={11} aria-hidden="true" /></Link>}
              </li>
            ))}
          </ul>
          {guidedPlan.ready && <span>Revisa el resultado y guarda las asignaciones; ninguna base se crea todavía.</span>}
        </div>
      )}

      {remainingSuggestions.length > 0 && (
        <div className="pulso-processing-intake-suggestions" aria-label="Públicos sugeridos por Monitoreo">
          <span>Disponibles desde Monitoreo</span>
          {remainingSuggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion.actor_key}
              ref={(node) => {
                if (node) suggestionButtonRefs.current.set(suggestion.actor_key, node);
                else suggestionButtonRefs.current.delete(suggestion.actor_key);
              }}
              onClick={() => { if (!busy) addEntry(suggestion); }}
              aria-label={`Agregar público ${suggestion.actor} desde Monitoreo`}
              aria-disabled={Boolean(busy)}
              aria-describedby="processing-intake-action-guidance"
            >
              <Plus size={12} aria-hidden="true" />
              {suggestion.actor}
            </button>
          ))}
        </div>
      )}

      <div className="pulso-processing-intake-list" role="list">
        {draft.map((entry, index) => {
          const resolved = processingIntakeResolvedEntry(
            entry,
            validated?.validation.entries ?? [],
            payload?.intake.entries ?? [],
          );
          const status = resolved ? processingIntakeStatusView(resolved.status) : null;
          const formId = processingIntakeEntryFormId(resolved, revisions, entry.instrument_revision_id);
          const actorInvalid = !entry.actor.trim();
          const baseLabelInvalid = !entry.base_label.trim();
          const revisionInvalid = !entry.instrument_revision_id;
          const fieldId = `processing-intake-${entry.entry_id}`;
          return (
            <fieldset className="pulso-processing-intake-row" role="listitem" key={entry.entry_id}>
              <legend>Público {index + 1}: {entry.actor.trim() || "sin nombre"}</legend>
              <div className="pulso-processing-intake-fields">
                <label htmlFor={`${fieldId}-actor`}>
                  <span>Público o grupo</span>
                  <input
                    id={`${fieldId}-actor`}
                    ref={(node) => {
                      if (node) actorInputRefs.current.set(entry.entry_id, node);
                      else actorInputRefs.current.delete(entry.entry_id);
                    }}
                    value={entry.actor}
                    onChange={(event) => updateEntry(entry.entry_id, { actor: event.target.value })}
                    disabled={!!busy}
                    required
                    aria-invalid={actorInvalid}
                    aria-describedby={actorInvalid ? `${fieldId}-actor-error` : undefined}
                  />
                  {actorInvalid && <small id={`${fieldId}-actor-error`} className="pulso-processing-intake-field-error">Escribe el nombre visible del público.</small>}
                </label>
                <label htmlFor={`${fieldId}-base-label`}>
                  <span>Nombre de la base</span>
                  <input
                    id={`${fieldId}-base-label`}
                    value={entry.base_label}
                    onChange={(event) => updateEntry(entry.entry_id, { base_label: event.target.value })}
                    disabled={!!busy}
                    required
                    aria-invalid={baseLabelInvalid}
                    aria-describedby={baseLabelInvalid ? `${fieldId}-base-label-error` : undefined}
                  />
                  {baseLabelInvalid && <small id={`${fieldId}-base-label-error`} className="pulso-processing-intake-field-error">Escribe cómo se identificará esta base.</small>}
                </label>
                <label className="pulso-processing-intake-revision-field" htmlFor={`${fieldId}-revision`}>
                  <span>Formulario publicado</span>
                  <select
                    id={`${fieldId}-revision`}
                    value={entry.instrument_revision_id}
                    onChange={(event) => updateEntry(entry.entry_id, { instrument_revision_id: event.target.value })}
                    disabled={!!busy || revisions.length === 0}
                    required
                    aria-invalid={revisionInvalid}
                    aria-describedby={revisionInvalid ? `${fieldId}-revision-error` : undefined}
                  >
                    <option value="">Selecciona un formulario…</option>
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
                  {revisionInvalid && (
                    <small id={`${fieldId}-revision-error`} className="pulso-processing-intake-field-error">
                      {revisions.length === 0
                        ? "El instrumento debe tener su lógica confirmada y una revisión publicada en el Editor."
                        : "Selecciona el formulario de este público."}
                    </small>
                  )}
                </label>
              </div>

              <div className="pulso-processing-intake-row-meta">
                {status ? (
                  <span
                    className={`pulso-processing-intake-status is-${status.tone}`}
                    title={status.detail}
                    aria-label={`${status.label}. ${status.detail}`}
                  >
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
                <details className="pulso-processing-intake-technical">
                  <summary>Detalles técnicos</summary>
                  <dl>
                    <div><dt>Clave del público</dt><dd>{entry.actor_key}</dd></div>
                    <div><dt>Clave de la base</dt><dd>{entry.base}</dd></div>
                    {entry.instrument_revision_id && <div><dt>Revisión fijada</dt><dd>{entry.instrument_revision_id}</dd></div>}
                  </dl>
                </details>
                <button
                  type="button"
                  className="pulso-processing-intake-remove"
                  aria-label={`Quitar público ${entry.actor}`}
                  title="Quitar del plan; no elimina el formulario ni su información"
                  aria-disabled={Boolean(busy)}
                  aria-describedby="processing-intake-action-guidance"
                  onClick={() => removeEntry(entry)}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            </fieldset>
          );
        })}
      </div>

      {draft.length === 0 && (
        <div className="pulso-processing-intake-empty">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>Aún no hay públicos asignados</strong>
            <span>{revisions.length > 0
              ? "Agrega un público y elige el formulario que le corresponde."
              : "Si el instrumento ya existe, confirma su lógica y publícalo desde el Editor XLSForm."}</span>
          </div>
          {revisions.length === 0 && <Link to="/editor-xlsform">Ir al Editor</Link>}
        </div>
      )}

      <footer className="pulso-processing-intake-actions">
        <p id="processing-intake-action-guidance" className="pulso-processing-intake-action-guidance" aria-live="polite">
          {actionGuidance}
        </p>
        <button
          type="button"
          ref={addActorButtonRef}
          onClick={() => { if (!addUnavailable) addEntry(); }}
          aria-disabled={addUnavailable}
          aria-describedby="processing-intake-action-guidance"
        >
          <Plus size={14} aria-hidden="true" /> Agregar público
        </button>
        <span className="pulso-processing-intake-action-spacer" />
        <button
          type="button"
          onClick={() => {
            if (busy) return;
            if (!dirty || window.confirm("¿Descartar los cambios locales y volver a cargar el plan guardado?")) {
              void load(true);
            }
          }}
          aria-disabled={Boolean(busy)}
          aria-describedby="processing-intake-action-guidance"
        >
          <RefreshCw size={14} className={busy === "reload" ? "pulso-spin" : ""} aria-hidden="true" />
          Recargar
        </button>
        <button
          type="button"
          onClick={() => { if (!validateUnavailable) void validateDraft(); }}
          aria-disabled={validateUnavailable}
          aria-describedby="processing-intake-action-guidance"
        >
          {busy === "validate" ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <ShieldCheck size={14} aria-hidden="true" />}
          Revisar asignaciones
        </button>
        <button
          type="button"
          className={!saveUnavailable ? "is-primary" : undefined}
          onClick={() => { if (!saveUnavailable) void saveDraft(); }}
          aria-disabled={saveUnavailable}
          aria-describedby="processing-intake-action-guidance"
        >
          {busy === "save" ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
          Guardar asignaciones
        </button>
      </footer>
    </section>
  );
}
