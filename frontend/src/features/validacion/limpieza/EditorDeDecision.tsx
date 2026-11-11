/**
 * Editor de la decisión sobre un hallazgo: acción, casos, justificación,
 * historial y barra de acciones. Salió de `tabs/LimpiezaTab.tsx`.
 */
import { type Dispatch, type ReactNode, type SetStateAction, useMemo } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronRight, Loader2, Save, Trash2 } from "../../../vendor/lucide-react";
import type { InstrumentoDrillResult } from "../../../api/client";
import type { LimpiezaDecision, LimpiezaDecisionActionType, LimpiezaQueueItem, ReglaTreatmentScope } from "../types";
import { RuleNarrative } from "../components/v2";
import { formatoConteo } from "../../../lib/formatoNumero";
import { type CaseRow, type ChoiceOption, type DecisionReadiness, type EditorForm, actionNeedsVariable, actionOptionsFor, buildChoiceOptions, buildVariableHoverLookup, decisionProcedureText, formatDateTime, getDecisionReadiness, humanizeAction, queueItemToRule } from "./modeloLimpieza";
import { dangerButtonStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle, summaryStyle } from "./estilosLimpieza";
import { CasesTable } from "./TablaDeCasos";
import { StatusBadge } from "./MensajeEnLinea";
import { FormField, renderActionSpecificFields } from "./CamposDeAccion";

// -----------------------------------------------------------------------------
// Editor de decisión (3 bloques visuales + historial colapsable)
// -----------------------------------------------------------------------------
export function EditorPanel({
  item,
  drill,
  form,
  setForm,
  variableOptions,
  caseRows,
  caseColumns,
  selectedCaseIdsSet,
  drillLoading,
  drillError,
  relatedDecisions,
  selectedDecisionId,
  onPickHistory,
  onNewDecision,
  historyOpen,
  setHistoryOpen,
  saveBusy,
  onSaveDraft,
  onSaveAndNext,
  onDelete,
  onNav,
  canDelete,
}: {
  item: LimpiezaQueueItem | null;
  drill: InstrumentoDrillResult | null;
  form: EditorForm;
  setForm: Dispatch<SetStateAction<EditorForm>>;
  variableOptions: string[];
  caseRows: CaseRow[];
  caseColumns: string[];
  selectedCaseIdsSet: Set<string>;
  drillLoading: boolean;
  drillError: string;
  relatedDecisions: LimpiezaDecision[];
  selectedDecisionId: string;
  onPickHistory: (id: string) => void;
  onNewDecision: () => void;
  historyOpen: boolean;
  setHistoryOpen: Dispatch<SetStateAction<boolean>>;
  saveBusy: boolean;
  onSaveDraft: () => void;
  onSaveAndNext: () => void;
  onDelete: () => void;
  onNav: (direction: "next" | "prev") => void;
  canDelete: boolean;
}) {
  const needsVariable = actionNeedsVariable(form.action_type);
  const allowsCaseSubset = form.action_type !== "ignore_rule";
  const selectable = allowsCaseSubset && !form.use_all_cases;

  // Rule narrativo para el hero del editor.
  const heroRule = useMemo(
    () => (item ? queueItemToRule(item, drill) : null),
    [item, drill],
  );
  const variableHoverLookup = useMemo(
    () => buildVariableHoverLookup(drill),
    [drill],
  );
  const choiceOptions = useMemo(
    () => buildChoiceOptions(drill, form.target_variable),
    [drill, form.target_variable],
  );
  const choiceOptionsByCode = useMemo(
    () => new Map(choiceOptions.map((option) => [option.code, option])),
    [choiceOptions],
  );
  const readiness = useMemo(
    () => getDecisionReadiness(form),
    [form],
  );
  const selectedCount = form.use_all_cases ? caseRows.length : form.target_case_ids.length;
  const coversWholeFinding =
    form.action_type === "ignore_rule" ||
    form.use_all_cases ||
    (caseRows.length > 0 && form.target_case_ids.length >= caseRows.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {item && heroRule && (
        <RuleNarrative
          rule={heroRule}
          variant="hero"
          nCasos={item.n_casos ?? null}
          porcentaje={item.porcentaje ?? null}
          status={item.pending ? "pending" : "ready"}
          variableHoverLookup={variableHoverLookup}
        />
      )}

      {/* Grid 2 columnas: formulario a la izquierda, casos + contexto a la derecha. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Columna izquierda: formulario de decisión */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Bloque 1: ¿Qué hacer? */}
          <DecisionBlock title="¿Qué hacer?">
        <FormField label="Acción">
          <select
            value={form.action_type}
            onChange={(event) => {
              const nextAction = event.target.value as LimpiezaDecisionActionType;
              setForm((current) => ({
                ...current,
                action_type: nextAction,
                scope_mode: nextAction === "ignore_rule" ? "all" : current.scope_mode,
                use_all_cases: nextAction === "ignore_rule" ? true : current.use_all_cases,
                target_case_ids: nextAction === "ignore_rule"
                  ? []
                  : current.scope_mode === "single"
                    ? current.target_case_ids.slice(0, 1)
                    : current.target_case_ids,
                target_variable: actionNeedsVariable(nextAction)
                  ? current.target_variable || variableOptions[0] || ""
                  : "",
              }));
            }}
            style={inputStyle}
          >
            {actionOptionsFor(form.action_type, item).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        {needsVariable && (
          <FormField label="Variable objetivo">
            <select
              value={form.target_variable}
              onChange={(event) => {
                const variable = event.target.value;
                setForm((current) => ({ ...current, target_variable: variable }));
              }}
              style={inputStyle}
            >
              {variableOptions.length === 0 ? (
                <option value="">Sin variables detectadas</option>
              ) : (
                variableOptions.map((variable) => (
                  <option key={variable} value={variable}>
                    {variable}
                  </option>
                ))
              )}
            </select>
          </FormField>
        )}

        {renderActionSpecificFields(form, setForm, choiceOptions)}
      </DecisionBlock>

      {/* Bloque 2: ¿Sobre qué casos? */}
      {allowsCaseSubset && (
        <DecisionBlock title="¿Sobre qué casos?">
          <ScopeModeSelector
            value={form.scope_mode}
            totalCases={caseRows.length}
            selectedCount={selectedCount}
            onChange={(mode) => {
              setForm((current) => ({
                ...current,
                scope_mode: mode,
                use_all_cases: mode === "all",
                target_case_ids: mode === "all"
                  ? []
                  : mode === "single"
                    ? current.target_case_ids.slice(0, 1)
                    : current.target_case_ids,
              }));
            }}
          />
          <div style={{ fontSize: "var(--pulso-type-caption-size)", color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
            {form.scope_mode === "all"
              ? "La acción se aplicará a todos los hallazgos de esta señal."
              : form.scope_mode === "single"
                ? "Selecciona un registro. Para resolver otros registros, guarda otra decisión para este mismo hallazgo."
                : "Selecciona los registros a los que aplicarás esta decisión."}
          </div>
      </DecisionBlock>
      )}

          <DecisionApplySummary
            form={form}
            readiness={readiness}
            totalCases={caseRows.length}
            selectedCount={selectedCount}
            optionsByCode={choiceOptionsByCode}
          />

          {/* Bloque 3: ¿Por qué? */}
          <DecisionBlock title="¿Por qué?">
            <FormField label="Justificación (obligatoria para dejar lista)">
              <textarea
                value={form.rationale}
                onChange={(event) => {
                  const rationale = event.target.value;
                  setForm((current) => ({ ...current, rationale }));
                }}
                rows={3}
                placeholder="Explica brevemente el motivo de esta decisión."
                style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
              />
            </FormField>
          </DecisionBlock>
        </div>

        {/* Columna derecha: casos observados co-ubicados con el form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 8 }}>
          <DecisionBlock title={`Casos observados${drill?.casos?.length ? ` (${formatoConteo(drill.casos.length)})` : ""}`}>
            <CasesTable
              rows={caseRows}
              columns={caseColumns}
              uuidCol={drill?.uuid_col ?? null}
              loading={drillLoading}
              error={drillError}
              selectable={selectable}
              selectionMode={form.scope_mode === "single" ? "single" : "multiple"}
              selectedCaseIds={selectedCaseIdsSet}
              onToggle={(caseId) => {
                setForm((current) => {
                  if (current.scope_mode === "single") {
                    return { ...current, target_case_ids: [caseId] };
                  }
                  const next = new Set(current.target_case_ids);
                  if (next.has(caseId)) next.delete(caseId);
                  else next.add(caseId);
                  return { ...current, target_case_ids: Array.from(next) };
                });
              }}
              onSelectAll={() => {
                setForm((current) => ({
                  ...current,
                  target_case_ids: caseRows.map((row) => row.id),
                }));
              }}
              onClear={() => {
                setForm((current) => ({ ...current, target_case_ids: [] }));
              }}
            />
          </DecisionBlock>
        </div>
      </div>

      {/* Historial colapsable */}
      {relatedDecisions.length > 0 && (
        <details open={historyOpen} onToggle={(e) => setHistoryOpen((e.target as HTMLDetailsElement).open)}>
          <summary style={summaryStyle}>
            {historyOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {formatoConteo(relatedDecisions.length)} decisión{relatedDecisions.length === 1 ? "" : "es"} previa{relatedDecisions.length === 1 ? "" : "s"} para esta regla
          </summary>
          <div style={{ paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" onClick={onNewDecision} style={secondaryButtonStyle}>
              Nueva decisión
            </button>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {relatedDecisions.map((decision) => (
                <button
                  key={decision.id}
                  type="button"
                  onClick={() => onPickHistory(decision.id)}
                  style={{
                    ...secondaryButtonStyle,
                    borderColor: decision.id === selectedDecisionId ? "var(--pulso-primary-border)" : undefined,
                    background: decision.id === selectedDecisionId ? "var(--pulso-primary-soft)" : "white",
                  }}
                >
                  <StatusBadge status={decision.status} />
                  <span>{humanizeAction(decision.action_type)}</span>
                  <span style={{ fontSize: "var(--pulso-type-micro-size)", color: "var(--pulso-text-soft)" }}>
                    {formatDateTime(decision.updated_at)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* Barra de acciones */}
      <ActionBar
        saveBusy={saveBusy}
        readiness={readiness}
        coversWholeFinding={coversWholeFinding}
        canDelete={canDelete}
        onSaveDraft={onSaveDraft}
        onSaveAndNext={onSaveAndNext}
        onDelete={onDelete}
        onNav={onNav}
      />
    </div>
  );
}

export function DecisionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: "var(--pulso-type-eyebrow-size)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--pulso-text-soft)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function ScopeModeSelector({
  value,
  totalCases,
  selectedCount,
  onChange,
}: {
  value: ReglaTreatmentScope;
  totalCases: number;
  selectedCount: number;
  onChange: (value: ReglaTreatmentScope) => void;
}) {
  const totalLabel = totalCases > 0 ? `${totalCases} caso${totalCases === 1 ? "" : "s"}` : "todos los casos";
  const selectedLabel = selectedCount > 0
    ? `${selectedCount} seleccionado${selectedCount === 1 ? "" : "s"}`
    : "elige casos";
  const items: Array<{ value: ReglaTreatmentScope; label: string; hint: string }> = [
    { value: "all", label: "Todos", hint: `Cubrir ${totalLabel}.` },
    { value: "selected", label: "Selección", hint: selectedLabel },
    { value: "single", label: "Uno por uno", hint: selectedCount === 1 ? "1 registro elegido" : "elige 1 registro" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: 8,
      }}
      role="radiogroup"
      aria-label="Alcance de la decisión"
    >
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.value)}
            style={{
              display: "grid",
              gap: 3,
              minHeight: 62,
              padding: "9px 10px",
              borderRadius: 10,
              border: `1px solid ${active ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
              background: active ? "var(--pulso-primary-soft)" : "var(--pulso-surface-2)",
              color: active ? "var(--pulso-primary)" : "var(--pulso-text)",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <strong style={{ fontSize: "var(--pulso-type-body-size)", lineHeight: 1.2 }}>{item.label}</strong>
            <span style={{ fontSize: "var(--pulso-type-micro-size)", lineHeight: 1.3, color: "var(--pulso-text-soft)" }}>
              {item.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DecisionApplySummary({
  form,
  readiness,
  totalCases,
  selectedCount,
  optionsByCode,
}: {
  form: EditorForm;
  readiness: DecisionReadiness;
  totalCases: number;
  selectedCount: number;
  optionsByCode: Map<string, ChoiceOption>;
}) {
  const action = humanizeAction(form.action_type);
  const scope =
    form.action_type === "ignore_rule"
      ? "El hallazgo quedará registrado sin modificar la base."
      : form.use_all_cases
        ? `Cubrirá ${totalCases || "todos los"} caso${totalCases === 1 ? "" : "s"} de este hallazgo.`
        : form.scope_mode === "single"
          ? selectedCount === 1
            ? "Cubrirá solo el registro seleccionado."
            : "Falta elegir un registro."
          : selectedCount > 0
            ? `Cubrirá ${selectedCount} registro${selectedCount === 1 ? "" : "s"} seleccionado${selectedCount === 1 ? "" : "s"}.`
            : "Falta elegir registros.";
  const procedure = decisionProcedureText(form, optionsByCode);

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${readiness.ready ? "var(--pulso-primary-border)" : "var(--pulso-warn-border)"}`,
        background: readiness.ready ? "var(--pulso-primary-soft)" : "var(--pulso-warn-bg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ fontSize: "var(--pulso-type-body-size)", color: "var(--pulso-text)" }}>Decisión a guardar</strong>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: "var(--pulso-type-micro-size)",
            fontWeight: 800,
            color: readiness.ready ? "var(--pulso-primary)" : "var(--pulso-warn-fg)",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {readiness.ready ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          {readiness.ready ? "Lista" : "Incompleta"}
        </span>
      </div>
      <div style={{ display: "grid", gap: 5, fontSize: "var(--pulso-type-caption-size)", color: "var(--pulso-text-soft)", lineHeight: 1.35 }}>
        <span><strong style={{ color: "var(--pulso-text)" }}>{action}</strong></span>
        <span>{scope}</span>
        {procedure && <span>{procedure}</span>}
      </div>
    </div>
  );
}

export function ActionBar({
  saveBusy,
  readiness,
  coversWholeFinding,
  canDelete,
  onSaveDraft,
  onSaveAndNext,
  onDelete,
  onNav,
}: {
  saveBusy: boolean;
  readiness: DecisionReadiness;
  coversWholeFinding: boolean;
  canDelete: boolean;
  onSaveDraft: () => void;
  onSaveAndNext: () => void;
  onDelete: () => void;
  onNav: (direction: "next" | "prev") => void;
}) {
  const primaryDisabled = saveBusy || !readiness.ready;
  const primaryLabel = coversWholeFinding ? "Guardar y siguiente" : "Guardar decisión parcial";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 10, borderTop: "1px solid var(--pulso-border)" }}>
      {!readiness.ready && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--pulso-warn-border)",
            background: "var(--pulso-warn-bg)",
            color: "var(--pulso-warn-fg)",
            fontSize: "var(--pulso-type-caption-size)",
            lineHeight: 1.35,
          }}
        >
          <AlertTriangle size={14} />
          <span>{readiness.issues[0]}</span>
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => onNav("prev")} style={secondaryButtonStyle} title="Anterior">
            ← Anterior
          </button>
          <button type="button" onClick={() => onNav("next")} style={secondaryButtonStyle} title="Siguiente">
            Siguiente →
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {canDelete && (
            <button type="button" onClick={onDelete} disabled={saveBusy} style={dangerButtonStyle}>
              <Trash2 size={13} />
              Eliminar
            </button>
          )}
          <button type="button" onClick={onSaveDraft} disabled={saveBusy} style={secondaryButtonStyle}>
            <Save size={13} />
            Guardar borrador
          </button>
          <button
            type="button"
            onClick={onSaveAndNext}
            disabled={primaryDisabled}
            className="pulso-primary"
            style={primaryButtonStyle}
            title={
              readiness.ready
                ? coversWholeFinding
                  ? "Guardar decisión y pasar al siguiente hallazgo"
                  : "Guardar esta decisión y mantener el hallazgo pendiente"
                : readiness.issues[0]
            }
          >
            {saveBusy ? <Loader2 size={13} className="pulso-spin" /> : <ArrowRight size={13} />}
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
