// Popup de lógica de SurveyMonkey del editor. Extraído de XlsformEditorPage.tsx — refactor puro, revamp 2026-10-16.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";
import { type ChoiceCodeMap, type SurveyMonkeyVisualLogicRule } from "../../../api/client";
import { RuleWizard, type ConfirmedRule } from "../shell/RuleWizard";
import { buildSurveyMonkeyLogicPack, importSurveyMonkeyLogicPack, type SurveyMonkeyLogicPackWarning } from "../shell/surveyMonkeyLogicPack";
import { PageFrame } from "../../../components/PageFrame";
import { ConfigIoButtons } from "../../../components/ConfigIoButtons";
import type { XlsformEditorWorkbook } from "../types";
import { workbookWithSurveyMonkeyLogic, refreshSurveyMonkeyAdvancedRules, visualActionCountForFooter, mergeAdvancedLogicRules, mergeVisualLogicRules, choiceCodeMapsWithOverrides, mergeChoiceCodeMaps } from "../state/editorHelpers";

export function SurveyMonkeyLogicPopup({
  workbook,
  sourceName,
  rules,
  visualRules,
  existingKoboLogic,
  overrides,
  busy,
  reviewConfirmation,
  alternativa,
  onLogicDraftChange,
  onRulesChange,
  onVisualRulesChange,
  onOverridesChange,
  onClose,
  onApply,
}: {
  workbook: XlsformEditorWorkbook;
  sourceName: string | null;
  rules: ConfirmedRule[];
  visualRules: SurveyMonkeyVisualLogicRule[];
  existingKoboLogic: Array<{ name: string; label: string; relevant: string }>;
  overrides: Record<string, string[]>;
  busy: boolean;
  reviewConfirmation: boolean;
  /** Segunda vía al confirmar: la lógica se hizo fuera de Prosecnur. */
  alternativa?: ReactNode;
  onLogicDraftChange: (
    rules: ConfirmedRule[],
    visualRules: SurveyMonkeyVisualLogicRule[],
    overrides: Record<string, string[]>,
    choiceCodeMaps?: ChoiceCodeMap[],
  ) => void;
  onRulesChange: (rules: ConfirmedRule[]) => void;
  onVisualRulesChange: (rules: SurveyMonkeyVisualLogicRule[]) => void;
  onOverridesChange: (next: Record<string, string[]>, nextChoiceCodeMaps?: ChoiceCodeMap[]) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const [logicPackWarnings, setLogicPackWarnings] = useState<SurveyMonkeyLogicPackWarning[]>([]);
  const refreshedOnOpenRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // El diálogo es una superficie modal real: el primer foco entra en la X,
  // Tab/Shift+Tab no escapan al editor que queda detrás y al cerrar devolvemos
  // el foco al control que lo abrió. Escape comparte la misma ruta de cierre.
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (refreshedOnOpenRef.current || rules.length === 0) return;
    refreshedOnOpenRef.current = true;
    let cancelled = false;
    const choiceCodeMaps = choiceCodeMapsWithOverrides(
      workbook,
      overrides,
      workbook.surveyMonkeyLogic?.choice_code_maps ?? [],
    );
    const workbookForRefresh = workbookWithSurveyMonkeyLogic(
      workbook,
      rules,
      visualRules,
      overrides,
      choiceCodeMaps,
    );
    void refreshSurveyMonkeyAdvancedRules(rules, workbookForRefresh, overrides).then((refreshedRules) => {
      if (cancelled) return;
      const changed = JSON.stringify(refreshedRules) !== JSON.stringify(rules);
      const mapsChanged = JSON.stringify(choiceCodeMaps) !== JSON.stringify(workbook.surveyMonkeyLogic?.choice_code_maps ?? []);
      if (changed || mapsChanged) onLogicDraftChange(refreshedRules, visualRules, overrides, choiceCodeMaps);
    });
    return () => {
      cancelled = true;
    };
  }, [onLogicDraftChange, overrides, rules, visualRules, workbook]);

  async function exportLogicPack() {
    const choiceCodeMaps = choiceCodeMapsWithOverrides(
      workbook,
      overrides,
      workbook.surveyMonkeyLogic?.choice_code_maps ?? [],
    );
    return buildSurveyMonkeyLogicPack({
      workbook,
      advancedRules: rules,
      visualRules,
      choiceOrderOverrides: overrides,
      choiceCodeMaps,
      sourceName,
    });
  }

  async function importLogicPack(parsed: unknown) {
    const imported = importSurveyMonkeyLogicPack(parsed, workbook);
    const warnings = [...imported.warnings];
    const nextRules = mergeAdvancedLogicRules(rules, imported.advanced_rules);
    const nextVisualRules = mergeVisualLogicRules(visualRules, imported.visual_rules, warnings);
    const nextOverrides = { ...overrides };
    for (const [key, labels] of Object.entries(imported.choice_order_overrides)) {
      if (nextOverrides[key] && JSON.stringify(nextOverrides[key]) !== JSON.stringify(labels)) {
        warnings.push({
          severity: "warn",
          message: `La pregunta ${key} ya tenía un orden de opciones personalizado; se conservó el existente.`,
        });
        continue;
      }
      nextOverrides[key] = labels;
    }
    const nextChoiceCodeMaps = mergeChoiceCodeMaps(
      workbook.surveyMonkeyLogic?.choice_code_maps ?? [],
      imported.choice_code_maps,
      warnings,
    );
    const workbookForRefresh = workbookWithSurveyMonkeyLogic(
      workbook,
      nextRules,
      nextVisualRules,
      nextOverrides,
      nextChoiceCodeMaps,
    );
    const refreshedRules = await refreshSurveyMonkeyAdvancedRules(
      nextRules,
      workbookForRefresh,
      nextOverrides,
    );
    setLogicPackWarnings(warnings);
    onLogicDraftChange(refreshedRules, nextVisualRules, nextOverrides, nextChoiceCodeMaps);
    const total = imported.advanced_rules.length + visualActionCountForFooter(imported.visual_rules);
    return `${total} salto${total === 1 ? "" : "s"} cargado${total === 1 ? "" : "s"} para revisar`;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lógica SurveyMonkey"
      data-audit-ready="xlsform-logic"
      style={{
        position: "fixed",
        inset: 0,
        // El toolbar del PageFrame usa z-index 1000. Este diálogo vive en un
        // portal y debe cubrirlo por completo para que encabezado, contenido y
        // pie formen una sola superficie modal accesible.
        zIndex: 2300,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        style={{
          width: "min(980px, 100%)",
          maxHeight: "min(860px, calc(100vh - 48px))",
          overflow: "hidden",
          borderRadius: 12,
          background: "white",
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.28)",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
        }}
      >
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--pulso-border, #e5e7eb)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Lógica SurveyMonkey</h2>
            <p style={{ margin: "4px 0 0", color: "var(--pulso-muted, #6b7280)", fontSize: 13, lineHeight: 1.45 }}>
              Configura saltos por opción sin ver código. Si necesitas condiciones complejas, usa ramificación avanzada.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
              <ConfigIoButtons
                filenamePrefix="pulso_surveymonkey_logic"
                exportLabel="Exportar lógica JSON"
                importLabel="Importar lógica JSON"
                onExport={exportLogicPack}
                onImport={importLogicPack}
              />
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar lógica SurveyMonkey"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
          >
            <X size={20} />
          </button>
        </header>
        <div style={{ padding: 20, overflowY: "auto" }}>
          {logicPackWarnings.length > 0 ? (
            <div
              role="status"
              style={{
                border: "1px solid #fde68a",
                background: "#fffbeb",
                color: "#854d0e",
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 14,
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              <strong>Revisión del paquete importado</strong>
              <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                {logicPackWarnings.slice(0, 8).map((warning, index) => (
                  <li key={`${warning.message}-${index}`}>{warning.message}</li>
                ))}
              </ul>
              {logicPackWarnings.length > 8 ? (
                <div style={{ marginTop: 6, fontWeight: 700 }}>
                  +{logicPackWarnings.length - 8} aviso{logicPackWarnings.length - 8 === 1 ? "" : "s"} adicional{logicPackWarnings.length - 8 === 1 ? "" : "es"}.
                </div>
              ) : null}
            </div>
          ) : null}
          <RuleWizard
            surveyId=""
            workbook={workbook}
            paginas={{}}
            paginasLabels={{}}
            confirmed={rules}
            visualRules={visualRules}
            existingKoboLogic={existingKoboLogic}
            onAdd={(rule) => onRulesChange([...rules, rule])}
            onUpdate={(id, rule) => onRulesChange(rules.map((current) => current.id === id ? rule : current))}
            onRemove={(id) => onRulesChange(rules.filter((rule) => rule.id !== id))}
            onClearAll={() => onRulesChange([])}
            onVisualRulesChange={onVisualRulesChange}
            overrides={overrides}
            choiceCodeMaps={workbook.surveyMonkeyLogic?.choice_code_maps ?? []}
            onOverridesChange={onOverridesChange}
          />
        </div>
        <footer
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--pulso-border, #e5e7eb)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            background: "#f8fafc",
          }}
        >
          <span style={{ color: "var(--pulso-muted, #6b7280)", fontSize: 12 }}>
            {reviewConfirmation && visualActionCountForFooter(visualRules) + rules.length === 0
              ? "Sin saltos configurados; confirma si ya verificaste que el formulario no los necesita."
              : `${visualActionCountForFooter(visualRules) + rules.length} salto${visualActionCountForFooter(visualRules) + rules.length === 1 ? "" : "s"} configurado${visualActionCountForFooter(visualRules) + rules.length === 1 ? "" : "s"}`}
          </span>
          <div style={{ display: "inline-flex", gap: 8 }}>
            {alternativa}
            <button type="button" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button
              type="button"
              className="pulso-primary"
              onClick={onApply}
              disabled={busy || (!reviewConfirmation && rules.length === 0 && visualActionCountForFooter(visualRules) === 0)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <CheckCircle2 size={14} /> {reviewConfirmation ? "Confirmar lógica revisada" : "Recalcular y aplicar"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
