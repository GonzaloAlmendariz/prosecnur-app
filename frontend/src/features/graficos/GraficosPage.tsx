import { useState } from "react";
import { Palette, Download, Save, Upload, RotateCcw, FileText } from "lucide-react";
import {
  apiGraficosPpt,
  apiGraficosWord,
  apiGraficosValidar,
  downloadUrl,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { usePlanStore } from "./store";
import TimelinePanel from "./TimelinePanel";
import SlideEditor from "./SlideEditor";
import SlidePreviewMockup from "./SlidePreviewMockup";
import PresetsModal from "./PresetsModal";

type ExportResult = { ok: true; file_id: string; size: number; n_slides: number };

export default function GraficosPage() {
  const { state, refresh } = useSession();
  const plan = usePlanStore((s) => s.plan);
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const presets = usePlanStore((s) => s.presets);
  const wPresets = usePlanStore((s) => s.wPresets);
  const loadPlan = usePlanStore((s) => s.loadPlan);
  const resetPlan = usePlanStore((s) => s.reset);

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [warns, setWarns] = useState<string[]>([]);
  const [pptFileId, setPptFileId] = useState<string | null>(null);
  const [docxFileId, setDocxFileId] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState<"ppt" | "word" | null>(null);
  const [exportJob, setExportJob] = useState<{ kind: "ppt" | "word"; id: string } | null>(null);

  const prepOk = !!state?.analitica_prep_ok;

  async function onExport(kind: "ppt" | "word") {
    setError(""); setWarns([]); setBusy(`validando ${kind}…`);
    try {
      const v = await apiGraficosValidar(plan);
      setWarns(v.warnings);
      if (!v.ok) { setError(v.errors.join("; ")); return; }
      const fn = kind === "ppt" ? apiGraficosPpt : apiGraficosWord;
      const out = await fn(plan, presets, wPresets);
      setExportJob({ kind, id: out.job_id });
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function onExportDone(data: ExportResult) {
    if (!exportJob) return;
    if (exportJob.kind === "ppt") setPptFileId(data.file_id);
    else setDocxFileId(data.file_id);
    setExportJob(null);
    void refresh();
  }

  function onExportError(message: string) {
    setError(message);
    setExportJob(null);
  }

  function onExportCancelled() {
    setExportJob(null);
  }

  function onSaveJson() {
    const text = JSON.stringify({ plan, presets, wPresets }, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pulso_plan_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onLoadJson(file?: File) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.plan?.slides) loadPlan(parsed.plan);
    } catch (e: unknown) {
      setError(`JSON inválido: ${(e as Error).message}`);
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 96px)" }}>
      <h1 className="pulso-page-title">Fase 5 — Reportes gráficos</h1>
      <p className="pulso-page-lead" style={{ marginBottom: 10 }}>
        Editor bloque por bloque: timeline a la izquierda, editor del slide al centro, preview de la secuencia a la derecha.
      </p>

      {!prepOk && (
        <div style={{ marginBottom: 10 }}>
          <Alert kind="warn">
            Primero prepara los datos en <strong>4. Analítica</strong>. La exportación requiere <code>rp_data</code> + <code>rp_inst</code> en sesión.
          </Alert>
        </div>
      )}

      <div style={{
        display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
        padding: "10px 14px", marginBottom: 10,
        background: "var(--pulso-surface)", border: "1px solid var(--pulso-border)",
        borderRadius: "var(--pulso-radius)", boxShadow: "var(--pulso-shadow-low)",
      }}>
        <button onClick={() => setPresetsOpen("ppt")} title="Estilos globales del PPT"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Palette size={13} /> Presets PPT
        </button>
        <button onClick={() => setPresetsOpen("word")} title="Estilos globales del Word"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Palette size={13} /> Presets Word
        </button>
        <span style={{ width: 1, height: 22, background: "var(--pulso-border)" }} />
        <button className="pulso-primary" onClick={() => onExport("ppt")} disabled={!prepOk || plan.slides.length === 0 || !!busy || !!exportJob}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <FileText size={13} /> Exportar .pptx
        </button>
        {pptFileId && (
          <a href={downloadUrl(pptFileId)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Download size={13} /> reporte.pptx
          </a>
        )}
        <button className="pulso-primary" onClick={() => onExport("word")} disabled={!prepOk || plan.slides.length === 0 || !!busy || !!exportJob}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <FileText size={13} /> Exportar .docx
        </button>
        {docxFileId && (
          <a href={downloadUrl(docxFileId)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Download size={13} /> reporte.docx
          </a>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={onSaveJson} disabled={plan.slides.length === 0}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Save size={13} /> Guardar JSON
        </button>
        <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Upload size={13} color="var(--pulso-text-soft)" />
          <input type="file" accept=".json" onChange={(e) => onLoadJson(e.target.files?.[0])} />
        </label>
        <button onClick={resetPlan} disabled={plan.slides.length === 0}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#991b1b" }}>
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      {exportJob && (
        <div style={{ marginBottom: 10 }}>
          <JobProgress<ExportResult>
            label={exportJob.kind === "ppt" ? "Exportando PPT" : "Exportando Word"}
            jobId={exportJob.id}
            onDone={onExportDone}
            onError={onExportError}
            onCancelled={onExportCancelled}
          />
        </div>
      )}

      {presetsOpen && <PresetsModal kind={presetsOpen} onClose={() => setPresetsOpen(null)} />}

      <div style={{ display: "flex", flex: 1, overflow: "hidden", border: "1px solid var(--pulso-border)", borderRadius: "var(--pulso-radius)", background: "var(--pulso-surface)", boxShadow: "var(--pulso-shadow-low)" }}>
        <TimelinePanel />
        <SlideEditor />
        <aside style={{ width: 420, borderLeft: "1px solid #e3e3e8", padding: "1rem", overflowY: "auto", background: "#fafbfc" }}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>Preview de la secuencia</h3>
          <div style={{ fontSize: 11, color: "#888", marginBottom: "0.75rem" }}>
            Maquetación aproximada de cada slide. Click selecciona el slide en el editor.
          </div>
          {plan.slides.length === 0 ? (
            <div style={{ fontSize: 12, color: "#888" }}>
              Agrega slides en el timeline para ver su maquetación.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {plan.slides.map((s, i) => (
                <div
                  key={s.id}
                  onClick={() => usePlanStore.setState({ selectedSlideId: s.id })}
                  style={{
                    cursor: "pointer",
                    padding: 4,
                    borderRadius: 8,
                    background: selectedSlideId === s.id ? "#dbeafe" : "transparent",
                    transition: "background 120ms",
                  }}
                >
                  <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "ui-monospace,monospace", marginBottom: 3, display: "flex", justifyContent: "space-between" }}>
                    <span>#{i + 1} · {s.tipo.replace("p_slide_", "")}</span>
                    {selectedSlideId === s.id && <span style={{ color: "#1e40af" }}>editando</span>}
                  </div>
                  <SlidePreviewMockup slide={s} />
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {busy && <div style={{ marginTop: 10 }}><Alert kind="info">{busy}</Alert></div>}
      {warns.length > 0 && <div style={{ marginTop: 10 }}><Alert kind="warn">{warns.join(" · ")}</Alert></div>}
      {error && <div style={{ marginTop: 10 }}><Alert kind="error">{error}</Alert></div>}
    </section>
  );
}
