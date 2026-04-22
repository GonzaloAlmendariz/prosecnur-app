import { useMemo, useState } from "react";
import { ArrowRight, Link2, X } from "lucide-react";
import { PreguntaAbierta } from "../../api/client";

// Diálogo para definir la relación de dependencia entre dos preguntas
// cuando el drag-drop NO cae en el caso clásico (text abierto → SO/SM).
//
// El flujo clásico (una pregunta de texto arrastrada sobre una SO/SM con
// "Otros, especifique") es directo y no necesita diálogo — basta con
// adoptar la child_col como texto a codificar. Los otros combos SÍ
// requieren que el analista decida:
//   (a) dirección de la dependencia — cuál codifica a cuál, y
//   (b) si el padre es SM, cuál es la columna dummy de "Otros".
//
// Ejemplos de combos no clásicos:
//   - integer sobre SO    → rangos numéricos codificados como opciones
//     (ej. p_edad integer → p_rango_edad SO = "joven/adulto/mayor").
//   - SO sobre SO         → dos preguntas del mismo concepto (v1 vs v2)
//     donde una provee el texto a codificar en la otra.
//   - SM sobre text       → ningún caso estándar; el dialog permite al
//     usuario decidir si hay alguna semántica válida.
//   - integer sobre text  → el texto es el destino de codificación.

type Side = "source-as-parent" | "target-as-parent";

export type RelationResult = {
  parent: string;      // el parent.parent (el que se queda como padre)
  child_col: string;   // columna del hijo (col_efectiva o parent del hijo)
  modo_so?: "padre" | "hijo";
  dummy_col?: string;
};

export function RelationDialog({
  source, target, onConfirm, onCancel,
}: {
  source: PreguntaAbierta;
  target: PreguntaAbierta;
  onConfirm: (result: RelationResult) => void;
  onCancel: () => void;
}) {
  // Target = sobre la que soltaste. Default: target es el padre.
  const [side, setSide] = useState<Side>("target-as-parent");
  const [modoSo, setModoSo] = useState<"padre" | "hijo">("padre");
  const [dummyCol, setDummyCol] = useState<string>("");

  const parent = side === "target-as-parent" ? target : source;
  const child = side === "target-as-parent" ? source : target;
  const childCol = child.col_efectiva || child.parent;

  const parentIsSO = parent.tipo === "select_one";
  const parentIsSM = parent.tipo === "select_multiple";
  const parentHasOptions = parent.opciones_sm && parent.opciones_sm.length > 0;

  const canConfirm = useMemo(() => {
    if (!parent.parent || !childCol) return false;
    // SM sin dummy_col aún es válido (el usuario podrá setearlo después
    // desde el picker que aparece en la card emparejada).
    return true;
  }, [parent.parent, childCol]);

  function handleConfirm() {
    if (!canConfirm) return;
    const r: RelationResult = { parent: parent.parent, child_col: childCol };
    if (parentIsSO) r.modo_so = modoSo;
    if (parentIsSM && dummyCol.trim()) r.dummy_col = dummyCol.trim();
    onConfirm(r);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="relation-dialog-title"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 100%)", maxHeight: "90vh",
          background: "white", borderRadius: 10,
          boxShadow: "var(--pulso-shadow-high)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--pulso-border)",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <Link2 size={18} color="var(--pulso-primary)" />
          <div style={{ flex: 1 }}>
            <h2 id="relation-dialog-title" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              Relacionar dos preguntas
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
              Decide cuál de las dos preguntas actúa como padre y cuál provee los textos o valores que se
              van a codificar.
            </p>
          </div>
          <button type="button" onClick={onCancel} className="pulso-icon" aria-label="Cerrar">
            <X size={14} />
          </button>
        </header>

        <div style={{ padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Step 1 — dirección */}
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="pulso-section-eyebrow">Paso 1 · Dirección de la codificación</div>
            <DirectionOption
              selected={side === "target-as-parent"}
              onSelect={() => setSide("target-as-parent")}
              from={source}
              to={target}
            />
            <DirectionOption
              selected={side === "source-as-parent"}
              onSelect={() => setSide("source-as-parent")}
              from={target}
              to={source}
            />
          </section>

          {/* Step 2 — modo (solo si parent es SO) */}
          {parentIsSO && (
            <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="pulso-section-eyebrow">
                Paso 2 · ¿Qué se va a codificar en <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{parent.parent}</code>?
              </div>
              <ModoOption
                value="padre"
                current={modoSo}
                onChange={setModoSo}
                title="Integrar las respuestas a las opciones originales (recomendado)"
                description={`Las respuestas de ${childCol} se vuelven nuevas opciones dentro de ${parent.parent}. Útil cuando ${child.parent} contiene variantes/texto libre del mismo concepto.`}
              />
              <ModoOption
                value="hijo"
                current={modoSo}
                onChange={setModoSo}
                title="Codificar como campo separado"
                description={`${childCol} se codifica en un campo aparte (${childCol}_recod). ${parent.parent} queda tal cual. Útil cuando las dos preguntas miden dimensiones distintas.`}
              />
            </section>
          )}

          {/* Step 2 — dummy col (solo si parent es SM) */}
          {parentIsSM && (
            <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="pulso-section-eyebrow">
                Paso 2 · Opción "Otros" en <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{parent.parent}</code>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
                En preguntas de múltiple elección, indica qué opción corresponde a "Otros, especifique" —
                es la columna dummy que marca cuándo hay texto libre para codificar.
                {parentHasOptions && " Puedes dejarlo vacío y configurarlo luego desde la card emparejada."}
              </p>
              <input
                type="text"
                value={dummyCol}
                onChange={(e) => setDummyCol(e.target.value)}
                placeholder={`ej. ${parent.parent}/99`}
                style={{
                  fontSize: 13, fontFamily: "ui-monospace, monospace",
                  padding: "7px 10px", borderRadius: 6,
                  border: "1px solid var(--pulso-border)",
                  background: "white", outline: "none",
                }}
              />
            </section>
          )}

          {/* Step 2 — aviso si parent no es SO/SM */}
          {!parentIsSO && !parentIsSM && (
            <section
              role="note"
              style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "10px 12px", borderRadius: 7,
                background: "var(--pulso-warn-bg)",
                border: "1px solid var(--pulso-warn-border)",
                color: "var(--pulso-warn-fg)", fontSize: 12, lineHeight: 1.5,
              }}
            >
              <span>
                El padre que elegiste ({parent.parent}) no es de opción única ni múltiple. La relación se
                va a guardar igual, pero el flujo de codificación estándar puede no aplicar — usarás
                los codificadores genéricos por tipo.
              </span>
            </section>
          )}
        </div>

        <footer
          style={{
            display: "flex", gap: 8, justifyContent: "flex-end",
            padding: "12px 18px",
            borderTop: "1px solid var(--pulso-border)",
            background: "var(--pulso-surface-2)",
          }}
        >
          <button type="button" onClick={onCancel} style={{ fontSize: 12, padding: "7px 14px" }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="pulso-primary"
            style={{
              fontSize: 12, padding: "7px 14px",
              display: "inline-flex", alignItems: "center", gap: 6,
              opacity: canConfirm ? 1 : 0.55,
            }}
          >
            Confirmar relación
          </button>
        </footer>
      </div>
    </div>
  );
}

// ---- Componentes internos -------------------------------------------

function DirectionOption({
  selected, onSelect, from, to,
}: {
  selected: boolean;
  onSelect: () => void;
  from: PreguntaAbierta;
  to: PreguntaAbierta;
}) {
  return (
    <label
      style={{
        display: "flex", gap: 10, alignItems: "stretch",
        padding: "10px 12px", borderRadius: 8,
        border: `1px solid ${selected ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
        background: selected ? "var(--pulso-primary-soft)" : "white",
        cursor: "pointer",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <input
        type="radio"
        checked={selected}
        onChange={onSelect}
        style={{ marginTop: 3, flexShrink: 0, accentColor: "var(--pulso-primary)" }}
      />
      <div style={{
        flex: 1, display: "grid", gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center", gap: 10,
      }}>
        <PreguntaChip p={from} tone={selected ? "primary-soft" : "neutral"} />
        <ArrowRight size={14} color={selected ? "var(--pulso-primary)" : "var(--pulso-text-soft)"} />
        <PreguntaChip p={to} tone={selected ? "primary-solid" : "neutral-strong"} />
      </div>
    </label>
  );
}

function PreguntaChip({
  p, tone,
}: {
  p: PreguntaAbierta;
  tone: "primary-soft" | "primary-solid" | "neutral" | "neutral-strong";
}) {
  const ts = TIPO_BADGE[p.tipo] ?? TIPO_BADGE.text;
  const isTarget = tone === "primary-solid" || tone === "neutral-strong";
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 3,
        padding: "6px 10px", borderRadius: 6,
        background:
          tone === "primary-solid" ? "white" :
          tone === "primary-soft" ? "white" :
          tone === "neutral-strong" ? "var(--pulso-surface-2)" :
          "var(--pulso-surface-2)",
        border: `1px solid ${
          tone === "primary-solid" ? "var(--pulso-primary)" :
          tone === "primary-soft" ? "var(--pulso-primary-border)" :
          "var(--pulso-border)"
        }`,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <code
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 12, fontWeight: 700,
            color: ts.fg,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {p.parent}
        </code>
        <span
          style={{
            fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.4,
            padding: "1px 6px", borderRadius: 4,
            background: ts.bg, color: ts.fg,
            flexShrink: 0,
          }}
        >
          {ts.label}
        </span>
      </div>
      <div
        style={{
          fontSize: 10, color: "var(--pulso-text-soft)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontWeight: isTarget ? 600 : 400,
        }}
        title={p.parent_label}
      >
        {p.parent_label}
      </div>
      <div
        style={{
          fontSize: 9, fontWeight: 600,
          textTransform: "uppercase", letterSpacing: 0.3,
          color: isTarget ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
        }}
      >
        {isTarget ? "Padre (recibe)" : "Hija (aporta)"}
      </div>
    </div>
  );
}

function ModoOption({
  value, current, onChange, title, description,
}: {
  value: "padre" | "hijo";
  current: "padre" | "hijo";
  onChange: (v: "padre" | "hijo") => void;
  title: string;
  description: string;
}) {
  const active = current === value;
  return (
    <label
      style={{
        display: "flex", gap: 10, padding: 12,
        border: `1px solid ${active ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
        borderRadius: 7,
        background: active ? "var(--pulso-primary-soft)" : "white",
        cursor: "pointer",
        alignItems: "flex-start",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <input
        type="radio"
        checked={active}
        onChange={() => onChange(value)}
        style={{ marginTop: 3, accentColor: "var(--pulso-primary)" }}
      />
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, color: active ? "var(--pulso-primary)" : "var(--pulso-text)" }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", marginTop: 3, lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
    </label>
  );
}

// Badges tipográficos por tipo (mirror de TIPO_STYLE de PreguntasLanding,
// compacto para el dialog).
const TIPO_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  select_multiple: { bg: "var(--tipo-sm-bg)", fg: "var(--tipo-sm-fg)", label: "SM" },
  select_one:      { bg: "var(--tipo-so-bg)", fg: "var(--tipo-so-fg)", label: "SO" },
  integer:         { bg: "var(--tipo-int-bg)", fg: "var(--tipo-int-fg)", label: "INT" },
  text:            { bg: "var(--tipo-text-bg)", fg: "var(--tipo-text-fg)", label: "TXT" },
};
