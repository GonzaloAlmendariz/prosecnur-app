import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, ClipboardList, Clock, Download, Upload } from "lucide-react";
import {
  apiCodifExportJson,
  apiCodifImportJson,
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

export function CodificarWizard({ onBackToOrganizar }: Props) {
  const [data, setData] = useState<PreguntaAbierta[] | null>(null);
  const [error, setError] = useState<string>("");
  const [activeParent, setActiveParent] = useState<string | null>(null);
  const [ioBusy, setIoBusy] = useState<"export" | "import" | null>(null);
  const [ioMsg, setIoMsg] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onExportJson() {
    setError("");
    setIoMsg("");
    setIoBusy("export");
    try {
      const bundle = await apiCodifExportJson();
      const { ok: _ok, ...payload } = bundle;
      void _ok;
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pulso_codificacion_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setIoMsg("Exportado ✓");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIoBusy(null);
      setTimeout(() => setIoMsg(""), 2500);
    }
  }

  async function onImportJson(file?: File) {
    if (!file) return;
    setError("");
    setIoMsg("");
    setIoBusy("import");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const r = await apiCodifImportJson(parsed);
      setIoMsg(`Importado ✓ (${r.n_preguntas_con_grupos} preguntas, ${r.n_marcadas} marcadas)`);
      // Refresca el listado para que se vean las marcadas/paired del JSON.
      const reload = await apiCodifPreguntasAbiertas();
      setData(reload.preguntas);
    } catch (e) {
      setError(`JSON inválido o rechazado por el backend: ${(e as Error).message}`);
    } finally {
      setIoBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setIoMsg(""), 4000);
    }
  }

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

          {/* Autoguardado + atajos para compartir/respaldar progreso */}
          <div
            style={{
              marginTop: 10, padding: 12,
              background: "var(--pulso-success-bg)",
              border: "1px solid var(--pulso-success-border)",
              borderRadius: 8,
              display: "flex", flexDirection: "column", gap: 10,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-success-fg)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={11} /> Autoguardado activo
              </div>
              <div style={{ fontSize: 11, color: "var(--pulso-success-fg)", opacity: 0.85, lineHeight: 1.4 }}>
                El progreso se guarda solo. Exporta un JSON para respaldarlo o compartirlo.
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button
                type="button"
                onClick={onExportJson}
                disabled={ioBusy === "export"}
                style={{ fontSize: 11, padding: "5px 8px", display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "center" }}
                title="Descarga el estado actual (draft de familias, grupos, marcadas)"
              >
                <Download size={11} /> {ioBusy === "export" ? "Exportando…" : "Exportar JSON"}
              </button>
              <label
                style={{
                  fontSize: 11, padding: "5px 8px",
                  display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "center",
                  cursor: ioBusy === "import" ? "wait" : "pointer",
                  border: "1px solid var(--pulso-border)", borderRadius: 4, background: "white",
                }}
                title="Restaura un estado previamente exportado"
              >
                <Upload size={11} />
                {ioBusy === "import" ? "Importando…" : "Importar JSON"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: "none" }}
                  onChange={(e) => onImportJson(e.target.files?.[0])}
                />
              </label>
            </div>
            {ioMsg && (
              <div style={{ fontSize: 11, color: "var(--pulso-success-fg)", fontWeight: 600 }}>{ioMsg}</div>
            )}
          </div>
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
      {/* Header: misma jerarquía que el resto del app — h2 humano + code-pill
          del identifier del XLSForm + chip de tipo + sección. */}
      <header style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <span
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: ts.bg, color: ts.fg,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: 11, fontWeight: 700,
            border: `1px solid ${ts.border}`,
          }}
          aria-hidden="true"
          title={ts.label}
        >
          {ts.label.slice(0, 2).toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 16, lineHeight: 1.3, fontWeight: 700 }}>
              {p.parent_label}
            </h2>
            <code
              title={`ID del XLSForm: ${p.parent}`}
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 11, fontWeight: 600,
                color: ts.fg, background: ts.bg,
                padding: "2px 8px", borderRadius: 4,
                border: `1px solid ${ts.border}`,
              }}
            >
              {p.parent}
            </code>
            <span
              style={{
                padding: "2px 8px", borderRadius: 999,
                background: ts.bg, color: ts.fg,
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3,
              }}
            >
              {ts.label}
              {p.modo_so === "hijo" && " · hijo"}
              {p.modo_so === "padre" && " · padre"}
            </span>
          </div>
          {p.section_label && (
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 4 }}>
              {p.section_label}
            </div>
          )}
        </div>
      </header>

      {/* Nav prev/next con ghost-buttons consistentes */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
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
