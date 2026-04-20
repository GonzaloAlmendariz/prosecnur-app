import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Clock } from "lucide-react";
import {
  apiCodifPreguntasAbiertas,
  arquetipoOf,
  PreguntaAbierta,
  PreguntaStatus,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import { RespuestasCodificador } from "./RespuestasCodificador";
import { IntegerCodificador } from "./IntegerCodificador";

type Props = {
  onBackToOrganizar: () => void;
  onApply: () => void;
  applyBusy: boolean;
};

const TIPO_STYLE: Record<string, { bg: string; border: string; fg: string; label: string }> = {
  select_multiple: { bg: "var(--tipo-sm-bg)", border: "var(--tipo-sm-border)", fg: "var(--tipo-sm-fg)", label: "Múltiple" },
  select_one: { bg: "var(--tipo-so-bg)", border: "var(--tipo-so-border)", fg: "var(--tipo-so-fg)", label: "Opción única" },
  integer: { bg: "var(--tipo-int-bg)", border: "var(--tipo-int-border)", fg: "var(--tipo-int-fg)", label: "Numérica" },
  text: { bg: "var(--tipo-text-bg)", border: "var(--tipo-text-border)", fg: "var(--tipo-text-fg)", label: "Texto abierto" },
};

export function CodificarWizard({ onBackToOrganizar, onApply, applyBusy }: Props) {
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

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Alert kind="info">Cargando preguntas marcadas…</Alert>;

  if (marcadas.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "white", border: "1px solid var(--pulso-border)", borderRadius: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>No hay preguntas marcadas para codificar</h3>
        <p style={{ fontSize: 13, color: "var(--pulso-text-soft)", marginTop: 8 }}>
          Vuelve al paso <strong>1. Organizar</strong> y marca las preguntas que quieres codificar (o empareja las SO/SM con sus "Otros, especifique").
        </p>
        <button className="pulso-primary" onClick={onBackToOrganizar} style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={14} /> Volver a organizar
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 280px) 1fr", gap: 16, alignItems: "flex-start" }}>
      {/* Sidebar */}
      <aside style={{ position: "sticky", top: 96, display: "flex", flexDirection: "column", gap: 4, maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-text-soft)", marginBottom: 6, padding: "0 6px" }}>
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
        <div style={{ marginTop: 14, padding: "0 6px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            onClick={onBackToOrganizar}
            style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "center" }}
          >
            <ArrowLeft size={12} /> Volver a organizar
          </button>
          <button
            type="button"
            className="pulso-primary"
            disabled={applyBusy}
            onClick={onApply}
            style={{ fontSize: 13 }}
          >
            Aplicar codificación
          </button>
        </div>
      </aside>

      {/* Central */}
      <main style={{ minWidth: 0 }}>
        {activePregunta ? (
          <CodificadorPane
            p={activePregunta}
            canPrev={activeIdx > 0}
            canNext={activeIdx < marcadas.length - 1}
            onPrev={gotoPrev}
            onNext={gotoNext}
            prevLabel={activeIdx > 0 ? marcadas[activeIdx - 1].parent : ""}
            nextLabel={activeIdx < marcadas.length - 1 ? marcadas[activeIdx + 1].parent : ""}
          />
        ) : (
          <Alert kind="info">Selecciona una pregunta del listado de la izquierda.</Alert>
        )}
      </main>
    </div>
  );
}

function SidebarItem({ p, active, onClick }: { p: PreguntaAbierta; active: boolean; onClick: () => void }) {
  const ts = TIPO_STYLE[p.tipo] ?? TIPO_STYLE.text;
  const sm = statusMeta(p.status);
  const StatusIcon = sm.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "4px 1fr",
        gap: 8,
        alignItems: "flex-start",
        textAlign: "left",
        padding: "6px 8px",
        border: active ? "1px solid var(--pulso-primary)" : "1px solid var(--pulso-border)",
        borderRadius: 6,
        background: active ? "var(--pulso-primary-soft)" : "white",
        cursor: "pointer",
      }}
    >
      <span style={{ width: 3, alignSelf: "stretch", background: ts.border, borderRadius: 2 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: active ? "var(--pulso-primary)" : ts.fg }}>
          {p.parent}
        </span>
        <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {p.parent_label}
        </span>
        <span style={{ fontSize: 9, color: "var(--pulso-text-soft)", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 2 }}>
          <StatusIcon size={10} color={sm.color} />
          {sm.label}
        </span>
      </div>
    </button>
  );
}

function statusMeta(s: PreguntaStatus): { label: string; color: string; Icon: typeof Circle; spin?: boolean } {
  if (s === "completo") return { label: "Codificada", color: "#166534", Icon: CheckCircle2 };
  if (s === "en-curso") return { label: "En curso", color: "#0e7490", Icon: Clock };
  if (s === "sin-datos") return { label: "Sin datos", color: "#6b7280", Icon: Circle };
  return { label: "Pendiente", color: "#1d4ed8", Icon: Circle };
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
    <section>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 className="pulso-page-title" style={{ fontFamily: "monospace", fontSize: 24, margin: 0 }}>{p.parent}</h1>
        <span style={{ padding: "3px 8px", borderRadius: 4, background: ts.bg, color: ts.fg, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {ts.label}
          {p.modo_so === "hijo" && " · hijo"}
          {p.modo_so === "padre" && " · padre"}
        </span>
        {p.section_label && (
          <span style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
            {p.section_label}
          </span>
        )}
      </div>
      <p className="pulso-page-lead" style={{ fontSize: 14 }}>{p.parent_label}</p>

      {/* Nav prev/next */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <button type="button" onClick={onPrev} disabled={!canPrev} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={12} /> {prevLabel || "Anterior"}
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={onNext} disabled={!canNext} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
          {nextLabel || "Siguiente"} <ArrowRight size={12} />
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
