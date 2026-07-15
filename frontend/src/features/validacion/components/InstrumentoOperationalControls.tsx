import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Settings2,
  X,
} from "../../../vendor/lucide-react";
import { apiV2ExplorarVariables } from "../../../api/client";
import type {
  ExploradorVariable,
  InstrumentoOperationalConfig,
  InstrumentoUpstreamUniverseSummary,
} from "../types";
import {
  buildOperationalNarratives,
  buildOperationalStatusLabels,
  DEFAULT_DUPLICATE_MINIMUM_COVERAGE,
  DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD,
  isOperationalVariableSuggested,
  MIN_DUPLICATE_COMPARISON_VARIABLES,
  rankOperationalVariables,
  validateOperationalConfig,
  type OperationalVariablePurpose,
} from "../operationalControlsModel";

type Props = {
  baseNombre?: string | null;
  value: InstrumentoOperationalConfig;
  upstreamUniverse?: InstrumentoUpstreamUniverseSummary | null;
  dirty?: boolean;
  disabled?: boolean;
  onChange: (value: InstrumentoOperationalConfig) => void;
};

export default function InstrumentoOperationalControls({
  baseNombre,
  value,
  upstreamUniverse,
  dirty = false,
  disabled = false,
  onChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [variables, setVariables] = useState<ExploradorVariable[]>([]);
  const [loadingVariables, setLoadingVariables] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setVariables([]);
    setLoadingVariables(true);
    setLoadError("");
    void apiV2ExplorarVariables(baseNombre)
      .then((inventory) => {
        if (cancelled) return;
        setVariables(inventory.secciones.flatMap((section) => section.variables));
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingVariables(false);
      });
    return () => {
      cancelled = true;
    };
  }, [baseNombre]);

  const errors = validateOperationalConfig(value);
  const activeCount = [
    value.field_period.enabled,
    value.duplicates.enabled,
  ].filter(Boolean).length;
  const narratives = useMemo(() => buildOperationalNarratives(value), [value]);
  const statusLabels = useMemo(() => buildOperationalStatusLabels(value), [value]);
  const duplicateSimilarity = Math.round(
    (value.duplicates.similarity_threshold || DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD) * 100,
  );
  const duplicateCoverage = Math.round(
    (value.duplicates.minimum_coverage || DEFAULT_DUPLICATE_MINIMUM_COVERAGE) * 100,
  );

  function update<K extends keyof InstrumentoOperationalConfig>(
    key: K,
    patch: Partial<InstrumentoOperationalConfig[K]>,
  ) {
    onChange({
      ...value,
      [key]: Object.assign({}, value[key], patch),
    });
  }

  return (
    <section className={`pulso-operational-controls${expanded ? " is-expanded" : ""}`}>
      <header className="pulso-operational-head">
        <button
          type="button"
          className="pulso-operational-disclosure"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          <span className="pulso-operational-icon"><Settings2 size={15} /></span>
          <span className="pulso-operational-heading">
            <strong>Controles operativos</strong>
            <small>Define las fechas de campo y compara respuestas entre entrevistas.</small>
          </span>
          <span className="pulso-operational-chips" aria-label="Estado de controles operativos">
            <StatusChip active={value.field_period.enabled} label={statusLabels.fieldPeriod} />
            <StatusChip active={value.duplicates.enabled} label={statusLabels.duplicates} />
            {dirty && <span className="pulso-operational-chip is-dirty">Cambios sin aplicar</span>}
            {Object.keys(errors).length > 0 && (
              <span className="pulso-operational-chip is-error">Requiere completar</span>
            )}
          </span>
          <span className="pulso-operational-edit-label">
            {activeCount > 0 ? "Editar" : "Configurar"}
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </button>
      </header>

      {expanded && (
        <div className="pulso-operational-body">
          <p className="pulso-operational-lead">
            Elige la variable de fecha y las preguntas que se compararán. Estas opciones se guardan al construir el plan.
          </p>

          {loadingVariables && <div className="pulso-operational-inline-note">Leyendo variables disponibles…</div>}
          {loadError && <div className="pulso-operational-error" role="alert">{loadError}</div>}

          {upstreamUniverse?.applied && (
            <div className="pulso-operational-upstream-universe" role="status">
              <Check size={13} aria-hidden="true" />
              <span>
                <strong>Encuestas incluidas:</strong>{" "}
                {upstreamUniverse.included.toLocaleString("es-PE")} de {upstreamUniverse.total.toLocaleString("es-PE")} recibidas.
              </span>
            </div>
          )}

          <div className="pulso-operational-card-grid">
            <OperationalCard
              icon={<CalendarDays size={15} />}
              title="Fechas de campo"
              description="Señala entrevistas fechadas antes del inicio o después del cierre."
              enabled={value.field_period.enabled}
              disabled={disabled}
              onToggle={(enabled) => update("field_period", { enabled })}
              error={errors.field_period}
            >
              <VariableSelect
                label="Variable de fecha de campo"
                value={value.field_period.variable}
                variables={variables}
                purpose="period"
                disabled={disabled}
                onChange={(variable) => update("field_period", { variable })}
              />
              <div className="pulso-operational-date-grid">
                <LabeledInput label="Inicio">
                  <input
                    type="date"
                    value={value.field_period.start_date}
                    max={value.field_period.end_date || undefined}
                    disabled={disabled}
                    onChange={(event) => update("field_period", { start_date: event.target.value })}
                  />
                </LabeledInput>
                <LabeledInput label="Cierre">
                  <input
                    type="date"
                    value={value.field_period.end_date}
                    min={value.field_period.start_date || undefined}
                    disabled={disabled}
                    onChange={(event) => update("field_period", { end_date: event.target.value })}
                  />
                </LabeledInput>
              </div>
              <LabeledInput label="Zona horaria">
                <input
                  type="text"
                  value={value.field_period.timezone}
                  disabled={disabled}
                  placeholder="America/Lima"
                  onChange={(event) => update("field_period", { timezone: event.target.value })}
                />
              </LabeledInput>
              <FixedPolicy>
                Las fechas vacías no se marcan como “fuera del periodo”; se revisan con una regla de completitud.
              </FixedPolicy>
            </OperationalCard>

            <OperationalCard
              icon={<Copy size={15} />}
              title="Entrevistas con respuestas similares"
              description={`Señala pares que coinciden en ${duplicateSimilarity}% o más de las respuestas seleccionadas.`}
              enabled={value.duplicates.enabled}
              disabled={disabled}
              onToggle={(enabled) => update("duplicates", { enabled })}
              error={errors.duplicates}
            >
              <VariableSelect
                label="Agregar respuesta a la comparación"
                value=""
                variables={variables.filter((variable) => !value.duplicates.variables.includes(variable.name))}
                purpose="duplicates"
                disabled={disabled}
                placeholder="Selecciona una pregunta…"
                onChange={(variable) => {
                  if (variable) update("duplicates", { variables: [...value.duplicates.variables, variable] });
                }}
              />
              <div className="pulso-operational-summary" role="status">
                <span>{value.duplicates.variables.length} preguntas seleccionadas</span>
                <span>Mínimo {MIN_DUPLICATE_COMPARISON_VARIABLES}</span>
              </div>
              <div className="pulso-operational-key-list" aria-label="Preguntas seleccionadas para comparar similitud">
                {value.duplicates.variables.length === 0 ? (
                  <small>Aún no elegiste preguntas. La app no selecciona ninguna automáticamente.</small>
                ) : value.duplicates.variables.map((variable, index) => (
                  <span key={variable}>
                    <b>{index + 1}</b>
                    <code>{variable}</code>
                    <button
                      type="button"
                      aria-label={`Quitar ${variable}`}
                      disabled={disabled}
                      onClick={() => update("duplicates", {
                        variables: value.duplicates.variables.filter((item) => item !== variable),
                      })}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <FixedPolicy>
                Umbral de similitud: {duplicateSimilarity}%. Se requiere información comparable en al menos {duplicateCoverage}%
                de las preguntas seleccionadas. Se señalan ambas entrevistas para revisión; ninguna se elimina.
              </FixedPolicy>
            </OperationalCard>
          </div>

          {narratives.length > 0 && (
            <section className="pulso-operational-preview">
              <header><Check size={14} /><strong>Reglas que se añadirán</strong></header>
              <div>
                {narratives.map((item) => (
                  <article key={item.key}>
                    <strong>{item.title}</strong>
                    <dl>
                      <dt>Base</dt><dd>{item.universe}</dd>
                      <dt>Variable(s)</dt><dd>{item.variables}</dd>
                      <dt>Condición</dt><dd>{item.condition}</dd>
                      <dt>Se registra un caso cuando</dt><dd>{item.violation}</dd>
                      <dt>Acción</dt><dd>{item.action}</dd>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

function StatusChip({ active, label }: { active: boolean; label: string }) {
  return <span className={`pulso-operational-chip${active ? " is-active" : ""}`}>{label}</span>;
}

function OperationalCard({
  icon,
  title,
  description,
  enabled,
  disabled,
  onToggle,
  error,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
  error?: string;
  children: ReactNode;
}) {
  const errorId = useId();
  return (
    <article className={`pulso-operational-card${enabled ? " is-enabled" : ""}`}>
      <header>
        <span className="pulso-operational-card-icon">{icon}</span>
        <span><strong>{title}</strong><small>{description}</small></span>
        <label className="pulso-operational-switch">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            aria-label={`${enabled ? "Desactivar" : "Activar"} ${title}`}
            aria-invalid={enabled && !!error}
            aria-describedby={enabled && error ? errorId : undefined}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <span aria-hidden="true" />
          <b>{enabled ? "Activo" : "Inactivo"}</b>
        </label>
      </header>
      <div className="pulso-operational-card-body" aria-disabled={!enabled}>
        <fieldset disabled={!enabled || disabled}>{children}</fieldset>
      </div>
      {enabled && error && <div id={errorId} className="pulso-operational-card-error" role="alert">{error}</div>}
    </article>
  );
}

function VariableSelect({
  label,
  value,
  variables,
  purpose,
  onChange,
  disabled,
  placeholder = "Selecciona una variable…",
}: {
  label: string;
  value: string;
  variables: ExploradorVariable[];
  purpose: OperationalVariablePurpose;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const ranked = useMemo(() => rankOperationalVariables(variables, purpose), [purpose, variables]);
  const selectedIsListed = !value || ranked.some((variable) => variable.name === value);
  return (
    <label className="pulso-operational-field">
      <span className="pulso-operational-label">{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {!selectedIsListed && <option value={value}>{value}</option>}
        {ranked.map((variable, index) => (
          <option key={variable.name} value={variable.name}>
            {index < 3 && isOperationalVariableSuggested(variable, purpose) ? "Prioridad sugerida · " : ""}{variable.label || variable.name} · {variable.name}
          </option>
        ))}
      </select>
      <small>
        {purpose === "period"
          ? "Sugerencias por nombre, tipo y completitud; todas las variables siguen disponibles."
          : "Ordenadas por completitud; tú decides qué preguntas comparar."}
      </small>
    </label>
  );
}

function LabeledInput({ label, children }: { label: string; children: ReactNode }) {
  return <label className="pulso-operational-field"><span className="pulso-operational-label">{label}</span>{children}</label>;
}

function FixedPolicy({ children }: { children: ReactNode }) {
  return <div className="pulso-operational-fixed-policy"><Check size={12} /><span>{children}</span></div>;
}
