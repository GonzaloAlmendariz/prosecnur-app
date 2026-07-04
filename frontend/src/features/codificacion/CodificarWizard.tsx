import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, ClipboardList, Clock } from "lucide-react";
import {
  apiCodifPreguntasAbiertas,
  arquetipoOf,
  PreguntaAbierta,
  PreguntaStatus,
} from "../../api/client";
import { LoadingBlock, ErrorBlock, EmptyState } from "../../components/States";
import { RespuestasCodificador } from "./RespuestasCodificador";
import { IntegerCodificador } from "./IntegerCodificador";

type Props = {
  onBackToOrganizar: () => void;
};

const TIPO_STYLE: Record<string, { bg: string; border: string; fg: string; label: string }> = {
  select_multiple: { bg: "var(--tipo-sm-bg)", border: "var(--tipo-sm-border)", fg: "var(--tipo-sm-fg)", label: "Múltiple" },
  select_one: { bg: "var(--tipo-so-bg)", border: "var(--tipo-so-border)", fg: "var(--tipo-so-fg)", label: "Opción única" },
  integer: { bg: "var(--tipo-int-bg)", border: "var(--tipo-int-border)", fg: "var(--tipo-int-fg)", label: "Numérica" },
  text: { bg: "var(--tipo-text-bg)", border: "var(--tipo-text-border)", fg: "var(--tipo-text-fg)", label: "Texto abierto" },
};

function questionLabel(p: PreguntaAbierta): string {
  const label = (p.parent_label ?? "").trim();
  if (label && label !== p.parent) return label;
  return p.parent;
}

function compactQuestionLabel(p?: PreguntaAbierta): string {
  if (!p) return "";
  const label = questionLabel(p);
  return label.length > 54 ? `${label.slice(0, 51)}...` : label;
}

function sidebarQuestionLabel(label: string): string {
  const clean = label.replace(/\s+/g, " ").trim();
  return clean.length > 118 ? `${clean.slice(0, 115)}...` : clean;
}

export function CodificarWizard({ onBackToOrganizar }: Props) {
  const [data, setData] = useState<PreguntaAbierta[] | null>(null);
  const [error, setError] = useState<string>("");
  const [activeParent, setActiveParent] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiCodifPreguntasAbiertas();
        setData(r.preguntas);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  const marcadas = useMemo(() => {
    if (!data) return [];
    return data
      .filter((p) => p.marcada)
      .sort((a, b) => (a.q_order ?? 999999) - (b.q_order ?? 999999));
  }, [data]);

  // Auto-pick first marked if none selected
  useEffect(() => {
    if (!activeParent && marcadas.length > 0) {
      setActiveParent(marcadas[0].parent);
    }
  }, [marcadas, activeParent]);

  const activeIdx = activeParent ? marcadas.findIndex((p) => p.parent === activeParent) : -1;
  const activePregunta = activeIdx >= 0 ? marcadas[activeIdx] : null;

  function gotoPrev() {
    if (activeIdx > 0) setActiveParent(marcadas[activeIdx - 1].parent);
  }
  function gotoNext() {
    if (activeIdx >= 0 && activeIdx < marcadas.length - 1) setActiveParent(marcadas[activeIdx + 1].parent);
  }

  if (error) return <ErrorBlock label="Error cargando preguntas" detail={error} />;
  if (!data) return <LoadingBlock label="Cargando preguntas marcadas…" />;

  if (marcadas.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList size={22} />}
        title="No hay preguntas marcadas para codificar"
        hint="Vuelve al paso 1 · Organizar y marca las preguntas que quieres codificar (o empareja las SO/SM con sus 'Otros, especifique')."
        cta={
          <button
            type="button"
            className="pulso-primary"
            onClick={onBackToOrganizar}
            style={{
              fontSize: 12, padding: "7px 14px",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <ArrowLeft size={13} /> Volver a organizar
          </button>
        }
      />
    );
  }

  return (
    <div className="pulso-codificacion-wizard">
      {/* Sidebar */}
      <aside className="pulso-codificacion-wizard-sidebar">
        <div className="pulso-codificacion-wizard-count">
          {marcadas.length} {marcadas.length === 1 ? "pregunta" : "preguntas"} para codificar
        </div>
        {marcadas.map((p) => (
          <SidebarItem
            key={p.parent}
            p={p}
            active={p.parent === activeParent}
            onClick={() => setActiveParent(p.parent)}
          />
        ))}
        <div className="pulso-codificacion-wizard-actions">
          <button
            type="button"
            onClick={onBackToOrganizar}
            className="pulso-codificacion-soft-button"
          >
            <ArrowLeft size={12} /> Volver a organizar
          </button>

          <div className="pulso-codificacion-autosave-card">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-success-fg)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={11} /> Autoguardado activo
              </div>
              <div style={{ fontSize: 11, color: "var(--pulso-success-fg)", opacity: 0.85, lineHeight: 1.4 }}>
                El progreso se guarda en el proyecto. La exportación e importación de ajustes vive en la barra superior.
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Central */}
      <main className="pulso-codificacion-wizard-main">
        {activePregunta ? (
          <CodificadorPane
            p={activePregunta}
            canPrev={activeIdx > 0}
            canNext={activeIdx < marcadas.length - 1}
            onPrev={gotoPrev}
            onNext={gotoNext}
            prevLabel={compactQuestionLabel(marcadas[activeIdx - 1])}
            nextLabel={compactQuestionLabel(marcadas[activeIdx + 1])}
          />
        ) : (
          <EmptyState
            icon={<ClipboardList size={20} />}
            title="Selecciona una pregunta"
            hint="Elige una pregunta del listado de la izquierda para empezar a codificar."
          />
        )}
      </main>
    </div>
  );
}

function SidebarItem({ p, active, onClick }: { p: PreguntaAbierta; active: boolean; onClick: () => void }) {
  const ts = TIPO_STYLE[p.tipo] ?? TIPO_STYLE.text;
  const sm = statusMeta(p.status);
  const StatusIcon = sm.Icon;
  const label = questionLabel(p);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pulso-codificacion-sidebar-question${active ? " is-active" : ""}`}
      title={`${label} (${p.parent})`}
    >
      <span className="pulso-codificacion-sidebar-question-accent" style={{ background: ts.border }} />
      <div className="pulso-codificacion-sidebar-question-copy">
        <span className="pulso-codificacion-sidebar-question-meta">
          <span
            className="pulso-codificacion-sidebar-question-code"
            style={{ color: active ? "var(--pulso-primary)" : ts.fg, background: ts.bg, borderColor: ts.border }}
          >
            {p.parent}
          </span>
          <span className="pulso-codificacion-sidebar-question-status">
            <StatusIcon size={10} color={sm.color} />
            {sm.label}
          </span>
        </span>
        <span className="pulso-codificacion-sidebar-question-label">
          {sidebarQuestionLabel(label)}
        </span>
      </div>
    </button>
  );
}

function statusMeta(s: PreguntaStatus): { label: string; color: string; Icon: typeof Circle; spin?: boolean } {
  if (s === "completo") return { label: "Codificada", color: "var(--pulso-success-fg)", Icon: CheckCircle2 };
  if (s === "en-curso") return { label: "En curso", color: "var(--pulso-status-in-progress)", Icon: Clock };
  if (s === "sin-datos") return { label: "Sin datos", color: "var(--pulso-status-empty)", Icon: Circle };
  return { label: "Pendiente", color: "var(--pulso-status-pending)", Icon: Circle };
}

function CodificadorPane({ p, canPrev, canNext, onPrev, onNext, prevLabel, nextLabel }: {
  p: PreguntaAbierta;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  const arq = arquetipoOf(p);
  const ts = TIPO_STYLE[p.tipo] ?? TIPO_STYLE.text;
  const label = questionLabel(p);

  // Todos los arquetipos que codifican valores discretos o texto abierto
  // usan el mismo RespuestasCodificador (agrupar respuestas \u2192 c\u00f3digo).
  // SM emparejada con text_col se codifica igual que SO-hijo (los textos
  // libres de quienes marcaron "Otros"); el bridge xlsx final genera las
  // nuevas columnas dummy. SO sin modo se trata como codificar valores
  // originales (modo padre impl\u00edcito) cuando el analista la marc\u00f3.
  const codificableInline =
    arq === "solitaria" ||
    arq === "adoptada" ||
    arq === "huerfana" ||
    arq === "auto" || // integer
    arq === "pareja-so" ||
    arq === "pareja-sm" || // SM con text_col
    arq === "config-so";

  return (
    <section className="pulso-codificacion-coder-pane">
      {/* Header: misma jerarquía que el resto del app: pregunta, ID del
          formulario, chip de tipo y sección. */}
      <header className="pulso-codificacion-coder-head">
        <span
          className="pulso-codificacion-type-avatar"
          style={{
            background: ts.bg, color: ts.fg,
            border: `1px solid ${ts.border}`,
          }}
          aria-hidden="true"
          title={ts.label}
        >
          {ts.label.slice(0, 2).toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pulso-codificacion-coder-meta">
            <code
              title={`ID del formulario: ${p.parent}`}
              className="pulso-codificacion-coder-code"
              style={{ color: ts.fg, background: ts.bg, borderColor: ts.border }}
            >
              {p.parent}
            </code>
            <span
              className="pulso-codificacion-coder-type"
              style={{ background: ts.bg, color: ts.fg }}
            >
              {ts.label}
              {p.modo_so === "hijo" && " · hijo"}
              {p.modo_so === "padre" && " · padre"}
            </span>
          </div>
          <h2 className="pulso-codificacion-coder-title">
            {label}
          </h2>
          {p.section_label && (
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 4 }}>
              {p.section_label}
            </div>
          )}
        </div>
      </header>

      {/* Nav prev/next con ghost-buttons consistentes */}
      <div className="pulso-codificacion-coder-nav">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="pulso-ghost-nav"
          style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <ArrowLeft size={12} /> <span style={{ opacity: 0.7 }}>Anterior:</span> {prevLabel || "—"}
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="pulso-ghost-nav"
          style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <span style={{ opacity: 0.7 }}>Siguiente:</span> {nextLabel || "—"} <ArrowRight size={12} />
        </button>
      </div>

      {/* Codificador */}
      {codificableInline ? (
        arq === "auto"
          ? <IntegerCodificador parent={p.parent} />
          : <RespuestasCodificador parent={p.parent} />
      ) : (
        <div style={{ padding: 18, background: "white", border: "1px solid var(--pulso-border)", borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: "var(--pulso-text-soft)", lineHeight: 1.6 }}>
            Esta pregunta tiene <strong>{p.n_respuestas}</strong> respuestas
            ({<strong>{p.n_unicas}</strong>} únicas) en la columna <code style={{ fontFamily: "monospace" }}>{p.col_efectiva}</code>.
            <br /><br />
            {arq === "no-aplica" && "Esta pregunta está desactivada."}
          </div>
        </div>
      )}
    </section>
  );
}
