import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckCircle2, Filter, Loader2, RotateCcw, Save, ShieldCheck } from "lucide-react";
import {
  apiCargaUniverseFilterApply,
  apiCargaUniverseFilterGet,
  apiCargaUniverseFilterPreview,
  type CargaUniverseFilterConfig,
  type CargaUniverseFilterState,
  type CargaUniverseObservedValue,
  type CargaUniverseSummary,
} from "../../api/client";
import {
  classifyUniverseValue,
  defaultUniverseFilterConfig,
  hasUniverseFilterChanges,
  isUniverseVariableSuggested,
  normalizeUniverseFilterConfig,
  normalizeUniverseSummary,
  rankUniverseVariables,
  setUniverseValueClassification,
  summarizeUniverseValues,
  universeFilterFingerprint,
  validateUniverseFilterConfig,
  type UniverseClassification,
} from "./universeFilterModel";

type Props = {
  baseNombre?: string | null;
  disabled?: boolean;
  onApplied?: (state: CargaUniverseFilterState) => void;
};

export function CargaUniverseFilter({ baseNombre, disabled = false, onApplied }: Props) {
  const controlId = useId();
  const [state, setState] = useState<CargaUniverseFilterState | null>(null);
  const [draft, setDraft] = useState<CargaUniverseFilterConfig>(() => defaultUniverseFilterConfig());
  const [observedValues, setObservedValues] = useState<CargaUniverseObservedValue[]>([]);
  const [previewSummary, setPreviewSummary] = useState<CargaUniverseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sinBase, setSinBase] = useState(false);
  const loadSequence = useRef(0);
  const previewSequence = useRef(0);

  useEffect(() => {
    const requestId = ++loadSequence.current;
    ++previewSequence.current;
    setLoading(true);
    setError("");
    setSinBase(false);
    setState(null);
    setObservedValues([]);
    setPreviewSummary(null);
    setDraft(defaultUniverseFilterConfig());
    void apiCargaUniverseFilterGet(baseNombre)
      .then((result) => {
        if (requestId !== loadSequence.current) return;
        const next = normalizeUniverseFilterConfig(result.config);
        const summary = normalizeUniverseSummary(result.summary);
        setState({ ...result, config: next, summary });
        setDraft(next);
        setObservedValues(result.observed_values ?? []);
        setPreviewSummary(summary);
      })
      .catch((reason: Error) => {
        if (requestId !== loadSequence.current) return;
        // Sin base registrada todavía: estado esperado antes de cargar
        // respuestas, no un error que alarme al usuario.
        if (reason.message.startsWith("[E_UNIVERSE_FILTER_BASE]")) setSinBase(true);
        else setError(reason.message);
      })
      .finally(() => {
        if (requestId === loadSequence.current) setLoading(false);
      });
  }, [baseNombre]);

  const draftFingerprint = universeFilterFingerprint(draft);
  useEffect(() => {
    if (!state || state.read_only || !draft.enabled || !draft.variable) {
      setPreviewing(false);
      return;
    }
    const requestId = ++previewSequence.current;
    const timeoutId = window.setTimeout(() => {
      setPreviewing(true);
      void apiCargaUniverseFilterPreview(draft, baseNombre)
        .then((result) => {
          if (requestId !== previewSequence.current) return;
          setObservedValues(result.observed_values ?? []);
          setPreviewSummary(normalizeUniverseSummary(result.summary));
        })
        .catch((reason: Error) => {
          if (requestId === previewSequence.current) setError(reason.message);
        })
        .finally(() => {
          if (requestId === previewSequence.current) setPreviewing(false);
        });
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [baseNombre, draftFingerprint, state?.read_only]); // eslint-disable-line react-hooks/exhaustive-deps

  const rankedVariables = useMemo(
    () => rankUniverseVariables(state?.variable_inventory ?? []),
    [state?.variable_inventory],
  );
  const appliedConfig = state?.config ?? defaultUniverseFilterConfig();
  const dirty = hasUniverseFilterChanges(draft, appliedConfig);
  const validationError = validateUniverseFilterConfig(draft);
  const localSummary = useMemo(
    () => summarizeUniverseValues(observedValues, draft),
    [draft, observedValues],
  );
  const summary = draft.enabled
    ? (observedValues.length > 0 ? localSummary : previewSummary ?? state?.summary ?? localSummary)
    : state?.summary ?? localSummary;

  function updateConfig(patch: Partial<CargaUniverseFilterConfig>) {
    setError("");
    setDraft((current) => normalizeUniverseFilterConfig({ ...current, ...patch }));
  }

  function classify(code: string, classification: UniverseClassification) {
    setError("");
    setDraft((current) => setUniverseValueClassification(current, code, classification));
  }

  async function apply() {
    if (validationError || state?.read_only) return;
    setSaving(true);
    setError("");
    try {
      const result = await apiCargaUniverseFilterApply(draft, baseNombre);
      const normalized = normalizeUniverseFilterConfig(result.config);
      const summary = normalizeUniverseSummary(result.summary);
      const next = { ...result, config: normalized, summary };
      setState(next);
      setDraft(normalized);
      setObservedValues(result.observed_values ?? []);
      setPreviewSummary(summary);
      onApplied?.(next);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    ++previewSequence.current;
    setDraft(appliedConfig);
    setObservedValues(state?.observed_values ?? []);
    setPreviewSummary(state?.summary ?? null);
    setError("");
  }

  const readOnly = state?.read_only === true;
  const applied = state?.config.enabled === true;

  return (
    <section className={`pulso-carga-universe${applied ? " is-applied" : ""}`} aria-labelledby={`${controlId}-title`}>
      <header className="pulso-carga-universe-head">
        <span className="pulso-carga-universe-icon" aria-hidden="true"><Filter size={16} /></span>
        <div className="pulso-carga-universe-title">
          <strong id={`${controlId}-title`}>Universo de análisis <span>(opcional)</span></strong>
          <small>Indica qué registros son entrevistas reales. La base original no se modifica.</small>
        </div>
        <span className={`pulso-carga-universe-status${applied ? " is-applied" : ""}`}>
          {applied ? "Universo aplicado" : "Sin filtro"}
        </span>
      </header>

      {loading ? (
        <div className="pulso-carga-universe-loading" role="status"><Loader2 size={14} className="pulso-spin" /> Leyendo configuración de la base…</div>
      ) : sinBase && !state ? (
        <div className="pulso-carga-universe-empty">
          Disponible cuando cargues las respuestas de la base.
        </div>
      ) : error && !state ? (
        <div className="pulso-carga-universe-error" role="alert">{error}</div>
      ) : state ? (
        <div className="pulso-carga-universe-body">
          {readOnly ? (
            <div className="pulso-carga-universe-inherited">
              <ShieldCheck size={16} aria-hidden="true" />
              <div>
                <strong>Universo heredado de {state.inherited_from || "la base madre"}</strong>
                <span>Esta base repetible conserva el mismo universo mediante su enlace relacional.</span>
              </div>
            </div>
          ) : (
            <>
              <label className="pulso-carga-universe-switch">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  disabled={disabled || saving}
                  onChange={(event) => updateConfig({ enabled: event.target.checked })}
                />
                <span aria-hidden="true" />
                <b>Usar una variable real/prueba</b>
              </label>

              {draft.enabled && (
                <div className="pulso-carga-universe-editor">
                  <label className="pulso-carga-universe-field">
                    <span>Variable de clasificación</span>
                    <select
                      value={draft.variable}
                      disabled={disabled || saving}
                      aria-invalid={!!validationError && !draft.variable}
                      onChange={(event) => {
                        ++previewSequence.current;
                        setObservedValues([]);
                        setPreviewSummary(null);
                        updateConfig({
                          variable: event.target.value,
                          real_values: [],
                          test_values: [],
                        });
                      }}
                    >
                      <option value="">Selecciona una variable…</option>
                      {rankedVariables.map((variable, index) => (
                        <option key={variable.variable} value={variable.variable}>
                          {index < 3 && isUniverseVariableSuggested(variable) ? "Prioridad sugerida · " : ""}
                          {variable.variable}{variable.n_distinct != null ? ` · ${variable.n_distinct} valores` : ""}
                        </option>
                      ))}
                    </select>
                    <small>Las sugerencias solo ordenan la lista; tú eliges siempre la variable.</small>
                  </label>

                  {draft.variable && (
                    <fieldset className="pulso-carga-universe-values" disabled={disabled || saving}>
                      <legend>Clasificación manual de valores</legend>
                      <div className="pulso-carga-universe-values-head" aria-hidden="true">
                        <span>Valor observado</span><span>Registros</span><span>Clasificación</span>
                      </div>
                      {observedValues.map((value, index) => (
                        <UniverseValueRow
                          key={`${value.value}:${value.missing ? "missing" : "value"}`}
                          controlId={controlId}
                          index={index}
                          value={value}
                          classification={classifyUniverseValue(draft, value.value)}
                          onChange={(classification) => classify(value.value, classification)}
                        />
                      ))}
                      {!previewing && observedValues.length === 0 && (
                        <div className="pulso-carga-universe-empty">No se encontraron valores observados para esta variable.</div>
                      )}
                      {previewing && <div className="pulso-carga-universe-previewing" role="status"><Loader2 size={12} className="pulso-spin" /> Actualizando conteos…</div>}
                    </fieldset>
                  )}
                </div>
              )}
            </>
          )}

          <UniverseSummary summary={summary} enabled={readOnly ? applied : draft.enabled} />

          {applied && !dirty && (
            <div className="pulso-carga-universe-proof" role="status">
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>
                <strong>Constancia aplicada.</strong> Variable <code>{state.config.variable}</code>
                {state.applied_at ? ` · ${formatAppliedAt(state.applied_at)}` : ""}. Crudo conservado.
              </span>
            </div>
          )}

          {validationError && draft.enabled && !readOnly && (
            <div className="pulso-carga-universe-error" role="alert">{validationError}</div>
          )}
          {error && state && <div className="pulso-carga-universe-error" role="alert">{error}</div>}

          {!readOnly && dirty && (
            <div className="pulso-carga-universe-actions">
              <button type="button" onClick={discard} disabled={disabled || saving}>
                <RotateCcw size={13} /> Descartar cambios
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() => void apply()}
                disabled={disabled || saving || !!validationError}
              >
                {saving ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
                {draft.enabled ? "Aplicar universo" : "Usar base completa"}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function UniverseValueRow({
  controlId,
  index,
  value,
  classification,
  onChange,
}: {
  controlId: string;
  index: number;
  value: CargaUniverseObservedValue;
  classification: UniverseClassification;
  onChange: (classification: UniverseClassification) => void;
}) {
  const name = `${controlId}-universe-${index}`;
  return (
    <div className="pulso-carga-universe-value-row">
      <span className="pulso-carga-universe-value-label">
        <strong>{value.value || "Vacío"}</strong>
        <code>{value.missing ? "sin valor" : value.value}</code>
      </span>
      <b>{value.count.toLocaleString("es-PE")}</b>
      <div className="pulso-carga-universe-classification" role="radiogroup" aria-label={`Clasificar ${value.value || "vacíos"}`}>
        {value.missing ? (
          <span className="is-fixed">Sin clasificar</span>
        ) : (["real", "test", "unclassified"] as UniverseClassification[]).map((option) => (
          <label key={option} className={classification === option ? "is-selected" : ""}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={classification === option}
              onChange={() => onChange(option)}
            />
            <span>{option === "real" ? "Real" : option === "test" ? "Prueba" : "Sin clasificar"}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function UniverseSummary({ summary, enabled }: { summary: CargaUniverseSummary; enabled: boolean }) {
  return (
    <div className="pulso-carga-universe-summary" aria-live="polite">
      <div><small>Base original</small><strong>{summary.total.toLocaleString("es-PE")}</strong><span>registros</span></div>
      <span aria-hidden="true">→</span>
      <div className={enabled ? "is-included" : ""}><small>Universo de análisis</small><strong>{(enabled ? summary.included : summary.total).toLocaleString("es-PE")}</strong><span>incluidos</span></div>
      {enabled && (
        <div className="pulso-carga-universe-exclusions">
          <span>{summary.excluded_test.toLocaleString("es-PE")} prueba</span>
          <span>{summary.excluded_unclassified.toLocaleString("es-PE")} sin clasificar</span>
        </div>
      )}
    </div>
  );
}

function formatAppliedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
}
