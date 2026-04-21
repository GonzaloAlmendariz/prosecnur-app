import { useState } from "react";
import {
  apiGraficosPpt,
  apiGraficosWord,
  apiGraficosValidar,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { usePlanStore } from "./store";
import { useGraficosAutosave } from "./useGraficosAutosave";
import { useGraficosShortcuts } from "./useGraficosShortcuts";
import { ShortcutsModal } from "./ShortcutsModal";
import { GraficosHeader } from "./GraficosHeader";
import { ConfiguracionGlobal } from "./ConfiguracionGlobal";
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
  const hydrated = usePlanStore((s) => s.hydrated);

  // Autosave: hidrata al montar + guarda debounced 2s en cada cambio.
  useGraficosAutosave();
  // Atajos: Cmd/Ctrl+Z (undo), +Shift+Z (redo), +D (duplicar), ? (ayuda).
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useGraficosShortcuts({ onOpenHelp: () => setShortcutsOpen(true) });

  const [busyValidating, setBusyValidating] = useState("");
  const [error, setError] = useState("");
  const [warns, setWarns] = useState<string[]>([]);
  const [pptFileId, setPptFileId] = useState<string | null>(null);
  const [docxFileId, setDocxFileId] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState<"ppt" | "word" | null>(null);
  const [exportJob, setExportJob] = useState<{ kind: "ppt" | "word"; id: string } | null>(null);

  const prepOk = !!state?.analitica_prep_ok;
  const canExport = prepOk && plan.slides.length > 0 && hydrated;

  async function onExport(kind: "ppt" | "word") {
    setError(""); setWarns([]); setBusyValidating(`validando ${kind}…`);
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
      setBusyValidating("");
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

  return (
    <section style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 96px)" }}>
      <h1 className="pulso-page-title">Fase 5 — Reportes gráficos</h1>
      <p className="pulso-page-lead" style={{ marginBottom: 10 }}>
        Editor bloque por bloque. Tu plan se guarda automáticamente — sigue editando sin preocuparte.
      </p>

      {!prepOk && (
        <div style={{ marginBottom: 10 }}>
          <Alert kind="warn">
            Primero prepara los datos en <strong>4. Analítica</strong>. La exportación requiere <code>rp_data</code> + <code>rp_inst</code> en sesión.
          </Alert>
        </div>
      )}

      <GraficosHeader
        onExportPpt={() => onExport("ppt")}
        onExportWord={() => onExport("word")}
        onOpenPresets={(kind) => setPresetsOpen(kind)}
        pptFileId={pptFileId}
        docxFileId={docxFileId}
        exportBusy={!!busyValidating || !!exportJob}
        exportJobKind={exportJob?.kind ?? null}
        canExport={canExport}
      />

      {prepOk && <ConfiguracionGlobal />}

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

      <div style={{
        display: "flex", flex: 1, overflow: "hidden",
        border: "1px solid var(--pulso-border)", borderRadius: "var(--pulso-radius)",
        background: "var(--pulso-surface)", boxShadow: "var(--pulso-shadow-low)",
      }}>
        <TimelinePanel />
        <SlideEditor />
        <aside style={{ width: 420, borderLeft: "1px solid var(--pulso-border)", padding: "1rem", overflowY: "auto", background: "var(--pulso-surface-2)" }}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>Preview de la secuencia</h3>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginBottom: "0.75rem" }}>
            Maquetación aproximada de cada slide. Click selecciona el slide en el editor.
          </div>
          {plan.slides.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
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
                    background: selectedSlideId === s.id ? "var(--pulso-primary-soft)" : "transparent",
                    transition: "background 120ms",
                  }}
                >
                  <div style={{ fontSize: 10, color: "var(--pulso-text-soft)", fontFamily: "ui-monospace,monospace", marginBottom: 3, display: "flex", justifyContent: "space-between" }}>
                    <span>#{i + 1} · {s.tipo.replace("p_slide_", "")}</span>
                    {selectedSlideId === s.id && <span style={{ color: "var(--pulso-primary)" }}>editando</span>}
                  </div>
                  <SlidePreviewMockup slide={s} />
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {busyValidating && <div style={{ marginTop: 10 }}><Alert kind="info">{busyValidating}</Alert></div>}
      {warns.length > 0 && <div style={{ marginTop: 10 }}><Alert kind="warn">{warns.join(" · ")}</Alert></div>}
      {error && <div style={{ marginTop: 10 }}><Alert kind="error">{error}</Alert></div>}

      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </section>
  );
}
