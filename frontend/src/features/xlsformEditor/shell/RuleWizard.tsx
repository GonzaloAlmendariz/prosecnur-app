import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ClipboardPaste, RotateCcw, Trash2, X } from "lucide-react";
import {
  apiXlsformEditorSmInterpretRule,
  type RuleInterpretation,
} from "../../../api/client";

// Wizard paso-a-paso para reglas de skip logic. El usuario pega UNA regla,
// Prosecnur la interpreta (resuelve labels desde la API SM), muestra el
// resumen en lenguaje humano + diagrama, y el usuario confirma o descarta.
// Las reglas confirmadas se acumulan en una lista y se aplican al final
// pegándolas como texto al endpoint principal de import.

export type ConfirmedRule = {
  id: string;
  texto: string;
  texto_humano: string;
};

const newId = () => Math.random().toString(36).slice(2, 9);

// Extrae el número de Q{N} (ej. "Q27" → "27"). Devuelve "" si la regla
// todavía no fue interpretada o el formato es inesperado.
function extractWhenVarKey(when_var: string | undefined): string {
  if (!when_var) return "";
  const m = /^[QPqp](\d+)$/.exec(when_var);
  return m ? m[1] : "";
}

export function RuleWizard({
  surveyId,
  token,
  paginas,
  paginasLabels,
  confirmed,
  onAdd,
  onRemove,
  overrides,
  onOverridesChange,
}: {
  surveyId: string;
  token: string;
  paginas: Record<string, string[]>;
  paginasLabels: Record<string, string>;
  confirmed: ConfirmedRule[];
  onAdd: (rule: ConfirmedRule) => void;
  onRemove: (id: string) => void;
  // Mapeo qref-string → labels en el orden que el usuario quiere asignar
  // a C1, C2, ... Persiste en el padre (ImportSurveyMonkeyDialog) para que
  // sobreviva al cierre del wizard y viaje al endpoint de import.
  overrides: Record<string, string[]>;
  onOverridesChange: (next: Record<string, string[]>) => void;
}) {
  const [draft, setDraft] = useState("");
  const [interp, setInterp] = useState<RuleInterpretation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function callInterpret(text: string, ovr: Record<string, string[]>) {
    if (!text.trim()) return null;
    setBusy(true);
    setError(null);
    try {
      const r = await apiXlsformEditorSmInterpretRule(text.trim(), {
        survey_id: surveyId,
        token,
        paginas,
        paginas_labels: paginasLabels,
        choice_order_overrides: ovr,
      });
      if (!r.ok) {
        setError(r.error);
        setInterp(null);
        return null;
      }
      setInterp(r);
      return r;
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      setInterp(null);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function interpret() {
    setInterp(null);
    await callInterpret(draft, overrides);
  }

  // Reordena la lista de labels para una pregunta dada y dispara
  // re-interpretación inmediata (así el resumen humano refleja el orden
  // corregido sin que el usuario tenga que volver a pulsar "Interpretar").
  async function reorderChoices(qrefKey: string, nextLabels: string[]) {
    const nextOverrides = { ...overrides, [qrefKey]: nextLabels };
    onOverridesChange(nextOverrides);
    await callInterpret(draft, nextOverrides);
  }

  async function resetOrder(qrefKey: string) {
    const next = { ...overrides };
    delete next[qrefKey];
    onOverridesChange(next);
    await callInterpret(draft, next);
  }

  function confirm() {
    if (!interp || !interp.ok) return;
    onAdd({
      id: newId(),
      texto: draft.trim(),
      texto_humano: interp.texto_humano,
    });
    setDraft("");
    setInterp(null);
    setError(null);
  }

  function discard() {
    setDraft("");
    setInterp(null);
    setError(null);
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
          <ClipboardPaste size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
          Pega UNA regla aquí (sintaxis del constructor SM)
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder='Ej: Q4 = "No he encontrado trabajo" => Ocultar Pág. 16, Ocultar Pág. 17.'
            rows={2}
            style={{
              flex: 1,
              padding: 8,
              border: "1px solid var(--pulso-border, #e5e7eb)",
              borderRadius: 6,
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              resize: "vertical",
            }}
          />
          <button
            type="button"
            onClick={interpret}
            disabled={busy || !draft.trim()}
            style={{
              background: draft.trim() ? "var(--pulso-accent, #2563eb)" : "#cbd5e1",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "0 18px",
              cursor: busy || !draft.trim() ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 500,
              alignSelf: "stretch",
              minWidth: 110,
            }}
          >
            {busy ? "…" : "Interpretar"}
          </button>
        </div>
        {error ? (
          <div
            style={{
              marginTop: 8,
              padding: 8,
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            {error}
          </div>
        ) : null}
      </div>

      {interp && interp.ok ? (
        <InterpretationCard
          interp={interp}
          busy={busy}
          hasOverride={Boolean(overrides[extractWhenVarKey(interp.regla_parseada.when_var)]?.length)}
          onConfirm={confirm}
          onDiscard={discard}
          onReorder={(nextLabels) => {
            const key = extractWhenVarKey(interp.regla_parseada.when_var);
            if (!key) return;
            void reorderChoices(key, nextLabels);
          }}
          onResetOrder={() => {
            const key = extractWhenVarKey(interp.regla_parseada.when_var);
            if (!key) return;
            void resetOrder(key);
          }}
        />
      ) : null}

      {confirmed.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>
            Reglas confirmadas ({confirmed.length})
          </h4>
          {confirmed.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "8px 10px",
                marginBottom: 6,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              <Check size={14} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#166534" }}>{r.texto_humano}</div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: "var(--pulso-muted, #6b7280)",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {r.texto}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(r.id)}
                aria-label="Eliminar regla confirmada"
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
              >
                <Trash2 size={14} color="#9ca3af" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InterpretationCard({
  interp,
  busy,
  hasOverride,
  onConfirm,
  onDiscard,
  onReorder,
  onResetOrder,
}: {
  interp: Extract<RuleInterpretation, { ok: true }>;
  busy: boolean;
  hasOverride: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
  onReorder: (nextLabels: string[]) => void;
  onResetOrder: () => void;
}) {
  const choices = interp.resolucion.choices_disponibles;

  function moveUp(idx: number) {
    if (idx <= 0) return;
    const labels = choices.map((c) => c.label);
    [labels[idx - 1], labels[idx]] = [labels[idx], labels[idx - 1]];
    onReorder(labels);
  }
  function moveDown(idx: number) {
    if (idx >= choices.length - 1) return;
    const labels = choices.map((c) => c.label);
    [labels[idx + 1], labels[idx]] = [labels[idx], labels[idx + 1]];
    onReorder(labels);
  }

  return (
    <div
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        padding: 14,
        background: "#fafafa",
        marginBottom: 12,
      }}
    >
      <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600 }}>
        Cómo lo interpreto
      </h4>

      <p
        style={{
          margin: "0 0 12px",
          padding: 10,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--pulso-text, #1f2937)",
        }}
      >
        {interp.texto_humano}
      </p>

      {/* Diagrama simple: condición arriba, acciones abajo */}
      <div
        style={{
          padding: 12,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            padding: "6px 10px",
            background: "#dbeafe",
            border: "1px solid #93c5fd",
            borderRadius: 6,
            display: "inline-block",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {interp.diagrama.origen.label}
        </div>
        <div style={{ marginLeft: 18, marginTop: 6, fontSize: 11, color: "var(--pulso-muted, #6b7280)" }}>
          ↓ {interp.diagrama.origen.condicion}
        </div>
        <div style={{ marginLeft: 18, marginTop: 4 }}>
          {interp.diagrama.edges.map((edge, i) => (
            <div
              key={i}
              style={{
                marginTop: 4,
                padding: "6px 10px",
                background: "#fef3c7",
                border: "1px solid #fde047",
                borderRadius: 6,
                display: "inline-block",
                fontSize: 12,
                marginRight: 6,
              }}
            >
              ⊘ {edge.target_label} <span style={{ color: "var(--pulso-muted, #6b7280)" }}>({edge.action})</span>
            </div>
          ))}
        </div>
      </div>

      {interp.warnings.length > 0 ? (
        <div
          style={{
            padding: 8,
            background: "#fef3c7",
            border: "1px solid #fde047",
            borderRadius: 6,
            fontSize: 12,
            color: "#854d0e",
            marginBottom: 12,
          }}
        >
          <strong>Avisos:</strong>
          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
            {interp.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {choices.length > 0 ? (
        <details
          open={hasOverride}
          style={{ marginBottom: 12, fontSize: 12 }}
        >
          <summary
            style={{
              cursor: "pointer",
              padding: "6px 10px",
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              fontWeight: 500,
              color: "var(--pulso-text, #1f2937)",
              listStyle: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span>
              Opciones disponibles ({choices.length})
              {hasOverride ? (
                <span style={{ marginLeft: 8, color: "#9333ea", fontSize: 11, fontWeight: 600 }}>
                  · orden personalizado
                </span>
              ) : null}
            </span>
            {hasOverride ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onResetOrder();
                }}
                disabled={busy}
                style={{
                  background: "transparent",
                  border: "1px solid var(--pulso-border, #e5e7eb)",
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 11,
                  cursor: busy ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: "var(--pulso-muted, #6b7280)",
                }}
              >
                <RotateCcw size={11} /> Restablecer
              </button>
            ) : null}
          </summary>
          <div
            style={{
              marginTop: 6,
              padding: "8px 12px",
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--pulso-muted, #6b7280)", lineHeight: 1.4 }}>
              Si el orden no coincide con tu cuestionario, usa ↑ ↓ para corregirlo.
              Las reglas resolverán C1, C2, … según el orden que dejes acá.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ color: "var(--pulso-muted, #6b7280)", textAlign: "left" }}>
                  <th style={{ padding: "4px 6px", width: 50 }}>Código</th>
                  <th style={{ padding: "4px 6px" }}>Etiqueta</th>
                  <th style={{ padding: "4px 6px", width: 60 }}>Tipo</th>
                  <th style={{ padding: "4px 6px", width: 70, textAlign: "right" }}>Orden</th>
                </tr>
              </thead>
              <tbody>
                {choices.map((ch, idx) => (
                  <tr key={`${ch.label}-${idx}`} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "4px 6px", fontFamily: "ui-monospace, monospace", fontWeight: 500 }}>{ch.code}</td>
                    <td style={{ padding: "4px 6px" }}>{ch.label}</td>
                    <td style={{ padding: "4px 6px", color: "var(--pulso-muted, #6b7280)", fontStyle: (ch.is_other || ch.is_none) ? "italic" : "normal" }}>
                      {ch.is_other ? "otro" : ch.is_none ? "ninguna" : ""}
                    </td>
                    <td style={{ padding: "4px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0 || busy}
                        aria-label="Subir"
                        style={{
                          background: "transparent",
                          border: "1px solid var(--pulso-border, #e5e7eb)",
                          borderRadius: 4,
                          padding: "2px 4px",
                          marginRight: 2,
                          cursor: idx === 0 || busy ? "not-allowed" : "pointer",
                          opacity: idx === 0 ? 0.4 : 1,
                        }}
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(idx)}
                        disabled={idx === choices.length - 1 || busy}
                        aria-label="Bajar"
                        style={{
                          background: "transparent",
                          border: "1px solid var(--pulso-border, #e5e7eb)",
                          borderRadius: 4,
                          padding: "2px 4px",
                          cursor: idx === choices.length - 1 || busy ? "not-allowed" : "pointer",
                          opacity: idx === choices.length - 1 ? 0.4 : 1,
                        }}
                      >
                        <ArrowDown size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          type="button"
          onClick={onDiscard}
          style={{
            background: "transparent",
            border: "1px solid var(--pulso-border, #e5e7eb)",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 12,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <X size={14} /> Descartar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          style={{
            background: "#16a34a",
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Check size={14} /> Confirmar y agregar siguiente
        </button>
      </div>
    </div>
  );
}
