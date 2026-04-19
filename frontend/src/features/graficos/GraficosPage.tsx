import { useState } from "react";
import {
  apiGraficosPpt,
  apiGraficosWord,
  apiGraficosValidar,
  downloadUrl,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { usePlanStore } from "./store";
import TimelinePanel from "./TimelinePanel";
import SlideEditor from "./SlideEditor";
import SlidePreviewMockup from "./SlidePreviewMockup";
import PresetsModal from "./PresetsModal";

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

  const prepOk = !!state?.analitica_prep_ok;

  async function onExport(kind: "ppt" | "word") {
    setError(""); setWarns([]); setBusy(`exportando ${kind}…`);
    try {
      const v = await apiGraficosValidar(plan);
      setWarns(v.warnings);
      if (!v.ok) { setError(v.errors.join("; ")); return; }
      const fn = kind === "ppt" ? apiGraficosPpt : apiGraficosWord;
      const out = await fn(plan, presets, wPresets);
      if (kind === "ppt") setPptFileId(out.file_id); else setDocxFileId(out.file_id);
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
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
    <section style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 2rem)" }}>
      <h1 style={{ marginTop: 0, marginBottom: "0.25rem" }}>Fase 5 — Reportes gráficos</h1>
      <p style={{ color: "#666", fontSize: 13, marginTop: 0, marginBottom: "0.75rem" }}>
        Editor bloque por bloque: timeline de slides a la izquierda, editor del slide seleccionado al centro, preview próximamente a la derecha.
      </p>

      {!prepOk && (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", padding: "0.5rem 0.75rem", borderRadius: 6, marginBottom: "0.5rem", fontSize: 13 }}>
          Primero prepara los datos en <strong>4. Analítica</strong>. La exportación requiere <code>rp_data</code> + <code>rp_inst</code> en sesión.
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", padding: "0.5rem 0", borderBottom: "1px solid #e3e3e8", marginBottom: "0.5rem" }}>
        <button onClick={() => setPresetsOpen("ppt")} title="Estilos globales del PPT">🎨 Presets PPT</button>
        <button onClick={() => setPresetsOpen("word")} title="Estilos globales del Word">🎨 Presets Word</button>
        <span style={{ width: 1, height: 20, background: "#e3e3e8" }} />
        <button onClick={() => onExport("ppt")} disabled={!prepOk || plan.slides.length === 0 || !!busy}>
          Exportar .pptx
        </button>
        {pptFileId && <a href={downloadUrl(pptFileId)} style={{ fontSize: 13 }}>reporte.pptx →</a>}
        <button onClick={() => onExport("word")} disabled={!prepOk || plan.slides.length === 0 || !!busy}>
          Exportar .docx
        </button>
        {docxFileId && <a href={downloadUrl(docxFileId)} style={{ fontSize: 13 }}>reporte.docx →</a>}
        <span style={{ flex: 1 }} />
        <button onClick={onSaveJson} disabled={plan.slides.length === 0}>Guardar JSON</button>
        <label style={{ fontSize: 12 }}>
          Cargar JSON: <input type="file" accept=".json" onChange={(e) => onLoadJson(e.target.files?.[0])} />
        </label>
        <button onClick={resetPlan} disabled={plan.slides.length === 0} style={{ color: "#c00" }}>Reset plan</button>
      </div>

      {presetsOpen && <PresetsModal kind={presetsOpen} onClose={() => setPresetsOpen(null)} />}

      <div style={{ display: "flex", flex: 1, overflow: "hidden", border: "1px solid #e3e3e8", borderRadius: 6 }}>
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

      {busy && <div style={{ color: "#0066cc", fontSize: 13, marginTop: "0.5rem" }}>{busy}</div>}
      {warns.length > 0 && (
        <div style={{ color: "#92400e", fontSize: 12, marginTop: "0.5rem" }}>
          ⚠ {warns.join(" · ")}
        </div>
      )}
      {error && <div style={{ color: "#c00", fontSize: 13, marginTop: "0.5rem" }}>⚠ {error}</div>}
    </section>
  );
}
