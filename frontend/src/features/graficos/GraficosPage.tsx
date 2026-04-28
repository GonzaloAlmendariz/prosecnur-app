import { useState } from "react";
import {
  apiGraficosPpt,
  apiGraficosWord,
  apiGraficosValidar,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { PageHeader } from "../../components/PageHeader";
import { usePlanStore } from "./store";
import { useGraficosAutosave } from "./useGraficosAutosave";
import { useGraficosShortcuts } from "./useGraficosShortcuts";
import { ShortcutsModal } from "./ShortcutsModal";
import { humanizeGraficosExportError, HumanizedError } from "./humanizeExportError";
import { GraficosHeader } from "./GraficosHeader";
import { EditorShell } from "./v2/shell/EditorShell";
import { useShortcutsV2 } from "./v2/shortcuts/useShortcutsV2";

type ExportResult = { ok: true; file_id: string; size: number; n_slides: number };

export default function GraficosPage() {
  const { state, refresh } = useSession();
  const plan = usePlanStore((s) => s.plan);
  const presets = usePlanStore((s) => s.presets);
  const wPresets = usePlanStore((s) => s.wPresets);
  const hydrated = usePlanStore((s) => s.hydrated);

  // Autosave: hidrata al montar + guarda debounced 2s en cada cambio.
  useGraficosAutosave();
  // Atajos: Cmd/Ctrl+Z (undo), +Shift+Z (redo), +D (duplicar), ? (ayuda).
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useGraficosShortcuts({ onOpenHelp: () => setShortcutsOpen(true) });
  // Atajos V2: J/K (nav), / (búsqueda), V/T/S (modo), 1-4 (tabs), F (fit canvas)
  useShortcutsV2();

  const [busyValidating, setBusyValidating] = useState("");
  const [error, setError] = useState<HumanizedError | null>(null);
  const [warns, setWarns] = useState<string[]>([]);
  const select = usePlanStore((s) => s.select);
  const [pptFileId, setPptFileId] = useState<string | null>(null);
  const [docxFileId, setDocxFileId] = useState<string | null>(null);
  const [exportJob, setExportJob] = useState<{ kind: "ppt" | "word"; id: string } | null>(null);

  const prepOk = !!state?.analitica_prep_ok;
  const canExport = prepOk && plan.slides.length > 0 && hydrated;

  async function onExport(kind: "ppt" | "word") {
    setError(null); setWarns([]); setBusyValidating(`validando ${kind}…`);
    try {
      const v = await apiGraficosValidar(plan);
      setWarns(v.warnings);
      if (!v.ok) {
        setError(humanizeGraficosExportError(v.errors.join("; "), plan));
        return;
      }
      const fn = kind === "ppt" ? apiGraficosPpt : apiGraficosWord;
      const out = await fn(plan, presets, wPresets);
      setExportJob({ kind, id: out.job_id });
    } catch (e: unknown) {
      setError(humanizeGraficosExportError((e as Error).message, plan));
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
    setError(humanizeGraficosExportError(message, plan));
    setExportJob(null);
  }

  function onExportCancelled() {
    setExportJob(null);
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 96px)" }}>
      <PageHeader
        title="Fase 5 — Reportes gráficos"
        lead="Editor bloque por bloque. Tu plan se guarda automáticamente — sigue editando sin preocuparte."
      />

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
        pptFileId={pptFileId}
        docxFileId={docxFileId}
        exportBusy={!!busyValidating || !!exportJob}
        exportJobKind={exportJob?.kind ?? null}
        canExport={canExport}
      />

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

      <EditorShell />

      {busyValidating && <div style={{ marginTop: 10 }}><Alert kind="info">{busyValidating}</Alert></div>}
      {warns.length > 0 && <div style={{ marginTop: 10 }}><Alert kind="warn">{warns.join(" · ")}</Alert></div>}
      {error && (
        <div style={{ marginTop: 10 }}>
          <Alert kind="error">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <strong>{error.message}</strong>
              {error.hint && (
                <div style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.5 }}>
                  {error.hint}
                </div>
              )}
              {error.slideRef && (
                <button
                  type="button"
                  onClick={() => {
                    if (error.slideRef) select(error.slideRef.id);
                    setError(null);
                  }}
                  style={{
                    alignSelf: "flex-start",
                    fontSize: 11, padding: "4px 10px",
                    border: "1px solid var(--pulso-danger-fg)",
                    borderRadius: 5,
                    background: "white", color: "var(--pulso-danger-fg)",
                    cursor: "pointer",
                  }}
                >
                  Ir al slide "{error.slideRef.label}"
                </button>
              )}
            </div>
          </Alert>
        </div>
      )}

      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </section>
  );
}
