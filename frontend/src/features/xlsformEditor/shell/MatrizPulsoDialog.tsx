import { useEffect, useMemo, useState } from "react";
import { X, Users, Sparkles, AlertTriangle } from "lucide-react";
import { planMatrizPulsoForms } from "./matrizPulso";

// Diálogo del importador de "Matriz PULSO IAC-CINDA". El backend detectó que el
// archivo es una matriz de preguntas por criterio con columnas de audiencia y
// devolvió las audiencias disponibles. Aquí el usuario elige cuáles convertir en
// formularios (por defecto las tres). Cada audiencia elegida genera un formulario
// en la biblioteca multi-formulario, respetando el tope del proyecto.
export function MatrizPulsoDialog({
  fileName,
  audiences,
  existingCount,
  maxForms,
  submitting = false,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  audiences: string[];
  existingCount: number;
  maxForms: number;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (selected: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(audiences));

  // Cerrar con Escape (salvo mientras se generan formularios).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, submitting]);

  function toggle(audience: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(audience)) next.delete(audience);
      else next.add(audience);
      return next;
    });
  }

  const selectedList = useMemo(
    () => audiences.filter((audience) => selected.has(audience)),
    [audiences, selected],
  );
  const plan = useMemo(
    () => planMatrizPulsoForms(selectedList, existingCount, maxForms),
    [selectedList, existingCount, maxForms],
  );
  const createCount = plan.toCreate.length;
  const canGenerate = createCount > 0 && !submitting;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="matriz-pulso-title"
      style={{
        position: "fixed",
        inset: 0,
        // Mismo criterio que el overlay de SurveyMonkey: por encima del chrome
        // del módulo (`.pulso-page-frame-toolbar` es z-index 1000).
        zIndex: 1400,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          maxHeight: "90vh",
          background: "white",
          borderRadius: 12,
          boxShadow: "var(--pulso-shadow-high)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--pulso-border, #e5e7eb)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}>
            <span
              style={{
                flex: "0 0 auto",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "var(--pulso-accent-soft, #eff6ff)",
                color: "var(--pulso-accent, #2563eb)",
              }}
            >
              <Users size={18} />
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 id="matriz-pulso-title" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
                Matriz PULSO IAC-CINDA
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "var(--pulso-muted, #6b7280)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {fileName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Cancelar"
            style={{
              background: "transparent",
              border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
              padding: 4,
              borderRadius: 4,
              color: "var(--pulso-muted, #6b7280)",
            }}
          >
            <X size={20} />
          </button>
        </header>

        <div
          style={{
            padding: 20,
            overflowY: "auto",
            flex: 1,
            minHeight: "var(--pulso-operational-min-dialog-body, 220px)",
            fontSize: 14,
          }}
        >
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
            Detectamos una matriz de preguntas por criterio con columnas de audiencia. Elige las
            audiencias que quieres convertir: crearemos <strong>un formulario por cada una</strong> en
            la biblioteca de este proyecto.
          </p>

          <fieldset
            style={{
              border: "1px solid var(--pulso-border, #e5e7eb)",
              borderRadius: 10,
              padding: 8,
              margin: 0,
              display: "grid",
              gap: 4,
            }}
          >
            <legend style={{ padding: "0 6px", fontSize: 12, fontWeight: 600, color: "var(--pulso-muted, #6b7280)" }}>
              Audiencias
            </legend>
            {audiences.map((audience) => {
              const checked = selected.has(audience);
              return (
                <label
                  key={audience}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 8,
                    cursor: submitting ? "not-allowed" : "pointer",
                    background: checked ? "var(--pulso-accent-soft, #eff6ff)" : "transparent",
                    border: `1px solid ${checked ? "var(--pulso-accent, #2563eb)" : "transparent"}`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={submitting}
                    onChange={() => toggle(audience)}
                    style={{ width: 16, height: 16, margin: 0, accentColor: "var(--pulso-accent, #2563eb)" }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#0f172a" }}>{audience}</span>
                </label>
              );
            })}
          </fieldset>

          {plan.capped ? (
            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 10,
                padding: 12,
                border: "1px solid #fde68a",
                borderRadius: 8,
                background: "#fffbeb",
                color: "#92400e",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              <AlertTriangle size={16} style={{ flex: "0 0 auto", marginTop: 1 }} />
              <span>
                Este proyecto admite hasta {maxForms} formularios y quedan {plan.availableSlots} libre
                {plan.availableSlots === 1 ? "" : "s"}. Se crearán solo{" "}
                {plan.toCreate.length > 0 ? plan.toCreate.join(", ") : "ninguno"}
                {plan.skipped.length > 0 ? `; quedará(n) fuera ${plan.skipped.join(", ")}.` : "."} Elimina
                formularios existentes para generar el resto.
              </span>
            </div>
          ) : null}
        </div>

        <footer
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--pulso-border, #e5e7eb)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "#f9fafb",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{
              background: "transparent",
              border: "1px solid var(--pulso-border, #e5e7eb)",
              borderRadius: 6,
              padding: "8px 16px",
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedList)}
            disabled={!canGenerate}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: canGenerate ? "var(--pulso-accent, #2563eb)" : "#cbd5e1",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              cursor: canGenerate ? "pointer" : "not-allowed",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <Sparkles size={15} />
            {submitting
              ? "Generando…"
              : createCount === 0
                ? "Elige una audiencia"
                : `Generar ${createCount} formulario${createCount === 1 ? "" : "s"}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
