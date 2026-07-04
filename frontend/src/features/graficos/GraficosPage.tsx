import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart2, CheckCircle2, Database, FileSpreadsheet } from "lucide-react";
import {
  apiGraficosPpt,
  apiGraficosWord,
  apiGraficosValidar,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { PageFrame } from "../../components/PageFrame";
import { usePlanStore } from "./store";
import { useGraficosAutosave } from "./useGraficosAutosave";
import { useGraficosShortcuts } from "./useGraficosShortcuts";
import { ShortcutsModal } from "./ShortcutsModal";
import { humanizeGraficosExportError, HumanizedError } from "./humanizeExportError";
import { GraficosHeader } from "./GraficosHeader";
import { EditorShell } from "./v2/shell/EditorShell";
import { useShortcutsV2 } from "./v2/shortcuts/useShortcutsV2";
import { buildGraficosConfigFromStore } from "./configSnapshot";

type ExportResult = { ok: true; file_id: string; filename?: string; size: number; n_slides: number };

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
  // Atajos V2: J/K (nav), / (búsqueda), V/T (modo), 1-4 (tabs)
  useShortcutsV2();

  const [busyValidating, setBusyValidating] = useState("");
  const [error, setError] = useState<HumanizedError | null>(null);
  const [warns, setWarns] = useState<string[]>([]);
  const select = usePlanStore((s) => s.select);
  const [pptFileId, setPptFileId] = useState<string | null>(null);
  const [docxFileId, setDocxFileId] = useState<string | null>(null);
  const [pptFilename, setPptFilename] = useState<string | null>(null);
  const [docxFilename, setDocxFilename] = useState<string | null>(null);
  const [exportJob, setExportJob] = useState<{ kind: "ppt" | "word"; id: string } | null>(null);

  const prepOk = !!state?.analitica_prep_ok;
  const canExport = prepOk && plan.slides.length > 0 && hydrated;

  useEffect(() => {
    function onActiveBaseChanged() {
      setPptFileId(null);
      setDocxFileId(null);
      setPptFilename(null);
      setDocxFilename(null);
      setError(null);
      setWarns([]);
    }
    window.addEventListener("pulso:active-base-changed", onActiveBaseChanged);
    return () => window.removeEventListener("pulso:active-base-changed", onActiveBaseChanged);
  }, []);

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
      const out = await fn(plan, presets, wPresets, buildGraficosConfigFromStore());
      setExportJob({ kind, id: out.job_id });
    } catch (e: unknown) {
      setError(humanizeGraficosExportError((e as Error).message, plan));
    } finally {
      setBusyValidating("");
    }
  }

  function onExportDone(data: ExportResult) {
    if (!exportJob) return;
    if (exportJob.kind === "ppt") {
      setPptFileId(data.file_id);
      setPptFilename(data.filename ?? null);
    } else {
      setDocxFileId(data.file_id);
      setDocxFilename(data.filename ?? null);
    }
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
    <>
    <PageFrame
      title="Fase 5 - Reportes gráficos"
      lead="Editor bloque por bloque con autoguardado y exportación PPT/Word."
      className="pulso-graficos-frame"
      headerMode="sr-only"
      bodyMode="fill"
      resetScrollKey={state?.active_base ?? ""}
      toolbar={
        <>
          {!prepOk && (
            <Alert kind="warn">
              Primero prepara los datos en <strong>4. Analítica</strong>. La exportación se activa cuando la base queda lista para generar reportes.
            </Alert>
          )}

          <GraficosHeader
            onExportPpt={() => onExport("ppt")}
            onExportWord={() => onExport("word")}
            pptFileId={pptFileId}
            docxFileId={docxFileId}
            pptFilename={pptFilename}
            docxFilename={docxFilename}
            exportBusy={!!busyValidating || !!exportJob}
            exportJobKind={exportJob?.kind ?? null}
            canExport={canExport}
          />

          {exportJob && (
            <JobProgress<ExportResult>
              label={exportJob.kind === "ppt" ? "Exportando PPT" : "Exportando Word"}
              jobId={exportJob.id}
              onDone={onExportDone}
              onError={onExportError}
              onCancelled={onExportCancelled}
            />
          )}

          {busyValidating && <Alert kind="info">{busyValidating}</Alert>}
          {warns.length > 0 && <Alert kind="warn">{warns.join(" · ")}</Alert>}
          {error && (
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
          )}
        </>
      }
    >
      {prepOk ? (
        <EditorShell />
      ) : (
        <GraficosPrepBlocked />
      )}
    </PageFrame>

      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </>
  );
}

function GraficosPrepBlocked() {
  return (
    <div className="pulso-graficos-blocked">
      <section className="pulso-graficos-prep-card" aria-label="Gráficos pendientes de Analítica">
        <div className="pulso-graficos-prep-visual" aria-hidden="true">
          <div className="pulso-graficos-prep-slide is-data">
            <span />
            <i />
            <i />
          </div>
          <div className="pulso-graficos-prep-flow">
            <span>01</span>
            <span>02</span>
            <span>03</span>
          </div>
          <div className="pulso-graficos-prep-slide is-chart">
            <span />
            <div>
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>

        <div className="pulso-graficos-prep-copy">
          <span className="pulso-graficos-prep-eyebrow">Antes de construir gráficos</span>
          <h2>Prepara la base en Analítica</h2>
          <p>
            Gráficos necesita la base preparada para leer etiquetas, variables recodificadas y cortes disponibles sin tocar tus respuestas originales.
          </p>

          <div className="pulso-graficos-prep-checks" aria-label="Qué se habilita después">
            <span>
              <Database size={14} />
              Base lista para reportes
            </span>
            <span>
              <FileSpreadsheet size={14} />
              Variables y etiquetas disponibles
            </span>
            <span>
              <CheckCircle2 size={14} />
              Exportación PPT/Word habilitada
            </span>
          </div>

          <Link className="pulso-graficos-prep-cta" to="/analitica">
            Ir a Analítica
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
