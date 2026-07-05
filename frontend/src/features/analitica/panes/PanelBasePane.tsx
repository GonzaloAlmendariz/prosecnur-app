import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  BookOpenCheck,
  CheckCircle2,
  Columns3,
  Database,
  FileSpreadsheet,
  FileText,
  FileWarning,
  GitMerge,
  KeyRound,
  ListChecks,
  Rows3,
  SlidersHorizontal,
  Table2,
} from "lucide-react";
import {
  AnaliticaPanelInfo,
  AnaliticaPanelNseCoverage,
  AnaliticaPanelSummary,
  apiAnaliticaPanelExport,
  apiAnaliticaPanelFichaTecnica,
  apiAnaliticaPanelInfo,
  apiAnaliticaPanelPreview,
} from "../../../api/client";
import { Alert } from "../../../components/Alert";
import { Panel } from "../../../components/Panel";
import { LoadingBlock } from "../../../components/States";
import { GenerateFooter, Section } from "../PaneKit";
import { type PanelConfig, useAnaliticaStore } from "../store";
import { useReporteRun } from "../useReporteRun";

type PanelView = "estructura" | "variables" | "nse" | "auditoria" | "exportar";

const VIEWS: Array<{ key: PanelView; label: string }> = [
  { key: "estructura", label: "Estructura" },
  { key: "variables", label: "Variables" },
  { key: "nse", label: "NSE" },
  { key: "auditoria", label: "Auditoría" },
  { key: "exportar", label: "Exportar" },
];

function normalizePanelSuffix(value: string | undefined, order: number | undefined) {
  const fallback = `med${order && order > 0 ? order : 1}`;
  const raw = (value || fallback).trim() || fallback;
  return raw.replace(/^(ola|met)(\d+)$/i, "med$2");
}

export function PanelBasePane() {
  const panel = useAnaliticaStore((s) => s.config.panel);
  const cruces = useAnaliticaStore((s) => s.config.cruces);
  const setPanel = useAnaliticaStore((s) => s.setPanel);
  const setPanelWave = useAnaliticaStore((s) => s.setPanelWave);
  const codebookRun = useReporteRun();
  const freqRun = useReporteRun();
  const crossesRun = useReporteRun();
  const auditRun = useReporteRun();
  const fichaRun = useReporteRun();
  const xlsxRun = useReporteRun();
  const csvRun = useReporteRun();
  const savRun = useReporteRun();
  const [info, setInfo] = useState<AnaliticaPanelInfo | null>(null);
  const [preview, setPreview] = useState<{
    summary: AnaliticaPanelSummary;
    preview: Record<string, unknown>[];
    audit_preview: Record<string, unknown>[];
    cobertura_nse: AnaliticaPanelNseCoverage[];
    columns: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<PanelView>("estructura");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const out = await apiAnaliticaPanelInfo();
        if (!cancelled) setInfo(out);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!info) return;
    if (!panel.key && info.key) setPanel({ key: info.key });
    for (const wave of info.waves ?? []) {
      const current = panel.waves.find((w) => w.base === wave.base);
      const normalizedSuffix = normalizePanelSuffix(current?.suffix ?? wave.suffix, current?.order ?? wave.order);
      if (!current) {
        setPanelWave(wave.base, {
          base: wave.base,
          label: wave.label,
          suffix: normalizePanelSuffix(wave.suffix, wave.order),
          order: wave.order,
        });
      } else if (current.suffix !== normalizedSuffix) {
        setPanelWave(wave.base, { suffix: normalizedSuffix });
      }
    }
    // Solo inicializa defaults descubiertos desde backend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.key, info?.waves?.length]);

  const waves = useMemo(() => {
    const saved = new Map(panel.waves.map((wave) => [wave.base, wave]));
    return (info?.waves ?? []).map((wave) => ({
      ...wave,
      label: saved.get(wave.base)?.label ?? wave.label,
      suffix: normalizePanelSuffix(saved.get(wave.base)?.suffix ?? wave.suffix, saved.get(wave.base)?.order ?? wave.order),
      order: saved.get(wave.base)?.order ?? wave.order,
    }));
  }, [info?.waves, panel.waves]);

  const activeConfig = useMemo(() => ({
    ...panel,
    key: panel.key || info?.key || "",
    waves: waves.map((wave) => ({
      base: wave.base,
      label: wave.label,
      suffix: wave.suffix,
      order: wave.order,
    })),
  }), [info?.key, panel, waves]);

  async function refreshPreview(nextView: PanelView = view) {
    setError("");
    try {
      const out = await apiAnaliticaPanelPreview(activeConfig, 20);
      setPreview(out);
      setView(nextView);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onGenerateFichaTecnica() {
    await fichaRun.runSync(() => apiAnaliticaPanelFichaTecnica(activeConfig));
  }

  async function onGenerateCodebook() {
    await codebookRun.runAsync(() => apiAnaliticaPanelExport(activeConfig, { formato: "libro_codigos" }));
  }

  async function onGenerateFrecuencias() {
    await freqRun.runAsync(() => apiAnaliticaPanelExport(activeConfig, { formato: "frecuencias" }));
  }

  async function onGenerateCruces() {
    await crossesRun.runAsync(() => apiAnaliticaPanelExport(activeConfig, { formato: "cruces" }));
  }

  async function onGenerateAuditoria() {
    await auditRun.runAsync(() => apiAnaliticaPanelExport(activeConfig, { formato: "auditoria" }));
  }

  async function onGenerateXlsx() {
    await xlsxRun.runAsync(() => apiAnaliticaPanelExport(activeConfig, {
      formato: "xlsx",
      valores: panel.formatos.xlsx.valores,
      multi_select: panel.formatos.xlsx.multi_select,
    }));
  }

  async function onGenerateCsv() {
    await csvRun.runAsync(() => apiAnaliticaPanelExport(activeConfig, {
      formato: "csv",
      valores: panel.formatos.csv.valores,
      separador: panel.formatos.csv.separador,
      multi_select: panel.formatos.csv.multi_select,
    }));
  }

  async function onGenerateSav() {
    await savRun.runAsync(() => apiAnaliticaPanelExport(activeConfig, {
      formato: "sav",
      incluir_sps: panel.formatos.sav.incluir_sps,
      multi_select: panel.formatos.sav.multi_select ?? "dummy_01",
    }));
  }

  const summary = preview?.summary ?? info?.summary;
  const candidateOptions = info?.candidates ?? [];
  const disabled = !info?.available || !activeConfig.key;
  const activeOutputCount = [
    panel.outputs.codebook,
    panel.outputs.frecuencias,
    panel.outputs.cruces,
    panel.outputs.auditoria,
  ].filter(Boolean).length;
  const crossVarsCount = cruces.cruces_vars.length;
  const crossConfigLabel = crossVarsCount > 0
    ? `${crossVarsCount} ${crossVarsCount === 1 ? "variable" : "variables"} configuradas`
    : "Auto: sexo, NSE y distrito";
  const suffixPreview = waves.length
    ? waves.map((wave) => wave.suffix).filter(Boolean).join(" / ")
    : "med1 / med2";

  return (
    <Panel className="analitica-panel-base-panel">
      <div className="analitica-report-shell analitica-panel-workbench">
        <div className="analitica-panel-docbar">
          <span className="analitica-panel-docbar-icon" aria-hidden="true">
            <GitMerge size={16} />
          </span>
          <div className="analitica-panel-docbar-copy">
            <span>Producto longitudinal</span>
            <strong>Base panel</strong>
            <small>Mediciones wide y entregables analíticos.</small>
          </div>
          <div className="analitica-report-overview analitica-report-overview--panel">
            <Metric label="Mediciones" value={info?.n_bases ?? 0} suffix="bases" />
            <Metric label="Llave" value={activeConfig.key || "Pendiente"} compact />
            <Metric label="Personas" value={summary?.n_panel_keys ?? "-"} suffix="panel" />
            <Metric label="Entregables" value={activeOutputCount} suffix="activos" />
          </div>
        </div>

        {loading ? (
          <LoadingBlock label="Leyendo mediciones del estudio..." />
        ) : error ? (
          <Alert kind="error">{error}</Alert>
        ) : (
          <>
            {!info?.available && (
              <Alert kind="warn">
                {info?.reason || "Base panel requiere al menos dos mediciones y una llave común."}
              </Alert>
            )}

            <div className="analitica-panel-commandbar">
              <div className="analitica-segmented analitica-segmented--five" role="tablist" aria-label="Vistas de base panel">
                {VIEWS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={view === item.key}
                    className={view === item.key ? "is-on" : undefined}
                    onClick={() => setView(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="pulso-secondary"
                onClick={() => refreshPreview("variables")}
                disabled={disabled}
              >
                <Rows3 size={14} />
                Previsualizar
              </button>
            </div>

            <PanelContractStrip
              ready={!disabled}
              previewReady={Boolean(preview)}
              suffixPreview={suffixPreview}
              crossConfigLabel={crossConfigLabel}
              nAuditRows={summary?.n_audit_rows}
            />

            {view === "estructura" && (
              <Section title="Llave y mediciones" subtitle="La salida conserva una fila por llave y columnas separadas por medición.">
                <div className="analitica-panel-form-grid">
                  <label className="analitica-panel-field">
                    <span><KeyRound size={13} /> Llave</span>
                    {candidateOptions.length ? (
                      <select
                        value={activeConfig.key}
                        onChange={(e) => setPanel({ key: e.target.value })}
                      >
                        {candidateOptions.map((candidate) => (
                          <option key={candidate.name} value={candidate.name}>
                            {candidate.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={activeConfig.key}
                        onChange={(e) => setPanel({ key: e.target.value })}
                        placeholder="numero_encuesta"
                      />
                    )}
                  </label>
                  <div className="analitica-panel-status-row">
                    <span className={`analitica-panel-badge ${info?.available ? "is-ok" : "is-warn"}`}>
                      {info?.available ? <Database size={12} /> : <AlertTriangle size={12} />}
                      {info?.available ? "Lista" : "Pendiente"}
                    </span>
                    <span>{info?.fuente ?? "fuente analitica"}</span>
                  </div>
                </div>
                <DenseTable
                  columns={["Medición", "Base", "Sufijo", "Filas", "Llaves", "Duplicadas", "Vacías"]}
                  rows={waves.map((wave) => [
                    <input
                      key={`${wave.base}-label`}
                      value={wave.label}
                      onChange={(e) => setPanelWave(wave.base, { label: e.target.value })}
                    />,
                    wave.base,
                    <input
                      key={`${wave.base}-suffix`}
                      value={wave.suffix}
                      onChange={(e) => setPanelWave(wave.base, { suffix: e.target.value })}
                    />,
                    wave.n_filas,
                    wave.n_llaves,
                    wave.n_llaves_duplicadas,
                    wave.n_llaves_vacias,
                  ])}
                />
              </Section>
            )}

            {view === "variables" && (
              <Section title="Preview wide" subtitle="Primeras filas generadas con la configuración actual; los entregables usan este orden longitudinal.">
                {!preview ? (
                  <EmptyPanelState icon={<Table2 size={16} />} label="Ejecuta una previsualización para ver columnas wide." />
                ) : (
                  <DenseObjectTable rows={preview.preview} maxCols={9} />
                )}
              </Section>
            )}

            {view === "nse" && (
              <Section title="Cobertura NSE" subtitle="Audita el NSE anexado y su cobertura en la base longitudinal.">
                <label className="analitica-panel-check">
                  <input
                    type="checkbox"
                    checked={panel.nse.enabled}
                    onChange={(e) => setPanel({ nse: { ...panel.nse, enabled: e.target.checked } })}
                  />
                  <span>Incluir cobertura NSE</span>
                </label>
                {!preview ? (
                  <EmptyPanelState icon={<BookOpenCheck size={16} />} label="Previsualiza para calcular cobertura NSE." />
                ) : (
                  <DenseObjectTable rows={preview.cobertura_nse} />
                )}
              </Section>
            )}

            {view === "auditoria" && (
              <Section title="Auditoría panel" subtitle="Duplicados, mediciones faltantes e inconsistencias por variable.">
                {!preview ? (
                  <EmptyPanelState icon={<FileWarning size={16} />} label="Previsualiza para generar auditoría." />
                ) : preview.audit_preview.length ? (
                  <DenseObjectTable rows={preview.audit_preview} />
                ) : (
                  <EmptyPanelState icon={<BookOpenCheck size={16} />} label="Sin incidencias en la muestra revisada." />
                )}
              </Section>
            )}

            {view === "exportar" && (
              <div className="analitica-panel-export-stack">
                <ExportReadinessPanel
                  outputs={panel.outputs}
                  crossConfigLabel={crossConfigLabel}
                  nseEnabled={panel.nse.enabled}
                  suffixPreview={suffixPreview}
                />

                <Section title="Reportes analíticos" subtitle="Genera cada entregable longitudinal por separado con el formato estándar de Analítica.">
                  <div className="analitica-panel-format-grid">
                    <PanelExportCard
                      icon={<BookOpenCheck size={15} />}
                      title="Libro de códigos"
                      copy="Formato Codebook de Analítica; preguntas equivalentes alineadas en bloques paralelos por medición."
                    >
                      <ToggleOutput
                        label="Activar libro"
                        checked={panel.outputs.codebook}
                        onChange={(next) => setPanel({ outputs: { ...panel.outputs, codebook: next } })}
                      />
                      <GenerateFooter
                        label="Generar libro"
                        busy={codebookRun.busy}
                        jobId={codebookRun.jobId}
                        fileId={codebookRun.fileId}
                        downloadName={codebookRun.filename ?? "base_panel_libro_codigos.xlsx"}
                        error={codebookRun.error}
                        onGenerate={onGenerateCodebook}
                        disabled={disabled || !panel.outputs.codebook}
                        disabledHint={disabled ? (info?.reason || "Selecciona una llave válida para todas las mediciones.") : "Activa este entregable para generarlo."}
                        perBase={codebookRun.perBase}
                        onJobDone={codebookRun.onJobDone}
                        onJobError={codebookRun.onJobError}
                        onJobCancelled={codebookRun.onJobCancelled}
                      />
                    </PanelExportCard>

                    <PanelExportCard
                      icon={<Table2 size={15} />}
                      title="Frecuencias"
                      copy="Tablas univariadas con el formato estándar de Frecuencias, respetando secciones, etiquetas y códigos especiales."
                    >
                      <ToggleOutput
                        label="Activar frecuencias"
                        checked={panel.outputs.frecuencias}
                        onChange={(next) => setPanel({ outputs: { ...panel.outputs, frecuencias: next } })}
                      />
                      <GenerateFooter
                        label="Generar frecuencias"
                        busy={freqRun.busy}
                        jobId={freqRun.jobId}
                        fileId={freqRun.fileId}
                        downloadName={freqRun.filename ?? "base_panel_frecuencias.xlsx"}
                        error={freqRun.error}
                        onGenerate={onGenerateFrecuencias}
                        disabled={disabled || !panel.outputs.frecuencias}
                        disabledHint={disabled ? (info?.reason || "Selecciona una llave válida para todas las mediciones.") : "Activa este entregable para generarlo."}
                        perBase={freqRun.perBase}
                        onJobDone={freqRun.onJobDone}
                        onJobError={freqRun.onJobError}
                        onJobCancelled={freqRun.onJobCancelled}
                      />
                    </PanelExportCard>

                    <PanelExportCard
                      icon={<GitMerge size={15} />}
                      title="Cruces"
                      copy={`Formato Cruces de Analítica. ${crossConfigLabel}; mantiene exclusiones de categorías cuando están configuradas.`}
                    >
                      <ToggleOutput
                        label="Activar cruces"
                        checked={panel.outputs.cruces}
                        onChange={(next) => setPanel({ outputs: { ...panel.outputs, cruces: next } })}
                      />
                      <GenerateFooter
                        label="Generar cruces"
                        busy={crossesRun.busy}
                        jobId={crossesRun.jobId}
                        fileId={crossesRun.fileId}
                        downloadName={crossesRun.filename ?? "base_panel_cruces.xlsx"}
                        error={crossesRun.error}
                        onGenerate={onGenerateCruces}
                        disabled={disabled || !panel.outputs.cruces}
                        disabledHint={disabled ? (info?.reason || "Selecciona una llave válida para todas las mediciones.") : "Activa este entregable para generarlo."}
                        perBase={crossesRun.perBase}
                        onJobDone={crossesRun.onJobDone}
                        onJobError={crossesRun.onJobError}
                        onJobCancelled={crossesRun.onJobCancelled}
                      />
                    </PanelExportCard>

                    <PanelExportCard
                      icon={<FileWarning size={15} />}
                      title="Auditoría"
                      copy="Duplicados, mediciones faltantes, cobertura NSE y configuración panel."
                    >
                      <ToggleOutput
                        label="Activar auditoría"
                        checked={panel.outputs.auditoria}
                        onChange={(next) => setPanel({ outputs: { ...panel.outputs, auditoria: next } })}
                      />
                      <GenerateFooter
                        label="Generar auditoría"
                        busy={auditRun.busy}
                        jobId={auditRun.jobId}
                        fileId={auditRun.fileId}
                        downloadName={auditRun.filename ?? "base_panel_auditoria.xlsx"}
                        error={auditRun.error}
                        onGenerate={onGenerateAuditoria}
                        disabled={disabled || !panel.outputs.auditoria}
                        disabledHint={disabled ? (info?.reason || "Selecciona una llave válida para todas las mediciones.") : "Activa este entregable para generarlo."}
                        perBase={auditRun.perBase}
                        onJobDone={auditRun.onJobDone}
                        onJobError={auditRun.onJobError}
                        onJobCancelled={auditRun.onJobCancelled}
                      />
                    </PanelExportCard>
                  </div>
                </Section>

                <Section title="Ficha técnica Word" subtitle="Genera la ficha metodológica en DOCX como archivo independiente.">
                  <GenerateFooter
                    label="Generar ficha Word"
                    busy={fichaRun.busy}
                    jobId={fichaRun.jobId}
                    fileId={fichaRun.fileId}
                    downloadName={fichaRun.filename ?? "ficha_tecnica_panel.docx"}
                    error={fichaRun.error}
                    onGenerate={onGenerateFichaTecnica}
                    disabled={disabled}
                    disabledHint={disabled ? (info?.reason || "Selecciona una llave válida para todas las mediciones.") : undefined}
                    perBase={fichaRun.perBase}
                    onJobDone={fichaRun.onJobDone}
                    onJobError={fichaRun.onJobError}
                    onJobCancelled={fichaRun.onJobCancelled}
                    variant="secondary"
                  />
                </Section>

                <Section title="Base wide por formato" subtitle="Exporta solo el dataset longitudinal con la misma lógica de Bases: etiquetas, multi-respuesta y metadatos SPSS.">
                  <div className="analitica-panel-format-grid">
                    <PanelExportCard
                      icon={<FileSpreadsheet size={15} />}
                      title="Excel wide"
                      copy="Nombres tecnicos en fila 1 y etiquetas de variable en fila 2."
                    >
                      <MiniSelect
                        label="Contenido"
                        value={panel.formatos.xlsx.valores}
                        onChange={(value) => setPanel({ formatos: { ...panel.formatos, xlsx: { ...panel.formatos.xlsx, valores: value as "codigos" | "etiquetas" | "ambos" } } })}
                        options={[
                          ["ambos", "Ambos"],
                          ["codigos", "Códigos"],
                          ["etiquetas", "Etiquetas"],
                        ]}
                      />
                      <MiniSelect
                        label="Multi-respuesta"
                        value={panel.formatos.xlsx.multi_select}
                        onChange={(value) => setPanel({ formatos: { ...panel.formatos, xlsx: { ...panel.formatos.xlsx, multi_select: value as "codigos_crudos" | "etiquetas_unidas" | "dummy_01" } } })}
                        options={MULTI_SELECT_OPTIONS}
                      />
                      <GenerateFooter
                        label="Exportar Excel"
                        busy={xlsxRun.busy}
                        jobId={xlsxRun.jobId}
                        fileId={xlsxRun.fileId}
                        downloadName={xlsxRun.filename ?? "base_panel_wide.xlsx"}
                        error={xlsxRun.error}
                        onGenerate={onGenerateXlsx}
                        disabled={disabled}
                        disabledHint={disabled ? (info?.reason || "Selecciona una llave válida para todas las mediciones.") : undefined}
                        perBase={xlsxRun.perBase}
                        onJobDone={xlsxRun.onJobDone}
                        onJobError={xlsxRun.onJobError}
                        onJobCancelled={xlsxRun.onJobCancelled}
                      />
                    </PanelExportCard>

                    <PanelExportCard
                      icon={<FileText size={15} />}
                      title="CSV wide"
                      copy="Archivo plano UTF-8 con códigos o etiquetas y separador configurable."
                    >
                      <MiniSelect
                        label="Contenido"
                        value={panel.formatos.csv.valores}
                        onChange={(value) => setPanel({ formatos: { ...panel.formatos, csv: { ...panel.formatos.csv, valores: value as "codigos" | "etiquetas" } } })}
                        options={[
                          ["etiquetas", "Etiquetas"],
                          ["codigos", "Códigos"],
                        ]}
                      />
                      <MiniSelect
                        label="Multi-respuesta"
                        value={panel.formatos.csv.multi_select}
                        onChange={(value) => setPanel({ formatos: { ...panel.formatos, csv: { ...panel.formatos.csv, multi_select: value as "codigos_crudos" | "etiquetas_unidas" | "dummy_01" } } })}
                        options={MULTI_SELECT_OPTIONS}
                      />
                      <MiniSelect
                        label="Separador"
                        value={panel.formatos.csv.separador}
                        onChange={(value) => setPanel({ formatos: { ...panel.formatos, csv: { ...panel.formatos.csv, separador: value as "," | ";" } } })}
                        options={[
                          [",", "Coma"],
                          [";", "Punto y coma"],
                        ]}
                      />
                      <GenerateFooter
                        label="Exportar CSV"
                        busy={csvRun.busy}
                        jobId={csvRun.jobId}
                        fileId={csvRun.fileId}
                        downloadName={csvRun.filename ?? "base_panel_wide.csv"}
                        error={csvRun.error}
                        onGenerate={onGenerateCsv}
                        disabled={disabled}
                        disabledHint={disabled ? (info?.reason || "Selecciona una llave válida para todas las mediciones.") : undefined}
                        perBase={csvRun.perBase}
                        onJobDone={csvRun.onJobDone}
                        onJobError={csvRun.onJobError}
                        onJobCancelled={csvRun.onJobCancelled}
                      />
                    </PanelExportCard>

                    <PanelExportCard
                      icon={<Archive size={15} />}
                      title="SPSS wide"
                      copy="SAV con labels, value-labels y niveles de medida inferidos."
                    >
                      <label className="analitica-panel-check">
                        <input
                          type="checkbox"
                          checked={panel.formatos.sav.incluir_sps}
                          onChange={(e) => setPanel({ formatos: { ...panel.formatos, sav: { ...panel.formatos.sav, incluir_sps: e.target.checked } } })}
                        />
                        <span>Incluir niveles_medida.sps</span>
                      </label>
                      <MiniSelect
                        label="Multi-respuesta"
                        value={panel.formatos.sav.multi_select ?? "dummy_01"}
                        onChange={(value) => setPanel({ formatos: { ...panel.formatos, sav: { ...panel.formatos.sav, multi_select: value as "codigos_crudos" | "etiquetas_unidas" | "dummy_01" } } })}
                        options={MULTI_SELECT_OPTIONS}
                      />
                      <GenerateFooter
                        label="Exportar SAV"
                        busy={savRun.busy}
                        jobId={savRun.jobId}
                        fileId={savRun.fileId}
                        downloadName={savRun.filename ?? (panel.formatos.sav.incluir_sps ? "base_panel_sav.zip" : "base_panel_wide.sav")}
                        error={savRun.error}
                        onGenerate={onGenerateSav}
                        disabled={disabled}
                        disabledHint={disabled ? (info?.reason || "Selecciona una llave válida para todas las mediciones.") : undefined}
                        perBase={savRun.perBase}
                        onJobDone={savRun.onJobDone}
                        onJobError={savRun.onJobError}
                        onJobCancelled={savRun.onJobCancelled}
                      />
                    </PanelExportCard>
                  </div>
                </Section>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function Metric({
  label,
  value,
  suffix,
  compact,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  compact?: boolean;
}) {
  return (
    <div className="analitica-stat">
      <span className="analitica-stat-label">{label}</span>
      <span className="analitica-stat-value" style={compact ? { fontSize: 13, paddingTop: 2 } : undefined}>
        {value}
        {suffix && <small>{suffix}</small>}
      </span>
    </div>
  );
}

function PanelContractStrip({
  ready,
  previewReady,
  suffixPreview,
  crossConfigLabel,
  nAuditRows,
}: {
  ready: boolean;
  previewReady: boolean;
  suffixPreview: string;
  crossConfigLabel: string;
  nAuditRows?: number;
}) {
  return (
    <div className="analitica-panel-contract-strip" aria-label="Estado de la base panel">
      <PanelContractItem
        icon={ready ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
        label="Estado"
        value={ready ? "Lista para exportar" : "Pendiente"}
        detail={ready ? "llave común detectada" : "revisar llave y mediciones"}
        tone={ready ? "ok" : "warn"}
      />
      <PanelContractItem
        icon={<Columns3 size={14} />}
        label="Columnas"
        value={suffixPreview}
        detail="sufijos longitudinales"
      />
      <PanelContractItem
        icon={<GitMerge size={14} />}
        label="Cruces"
        value={crossConfigLabel}
        detail="columnas de comparación"
      />
      <PanelContractItem
        icon={<FileWarning size={14} />}
        label="Auditoría"
        value={previewReady ? `${nAuditRows ?? 0} filas` : "sin preview"}
        detail={previewReady ? "incidencias revisadas" : "pendiente de cálculo"}
      />
    </div>
  );
}

function PanelContractItem({
  icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  return (
    <div className={`analitica-panel-contract-item is-${tone}`}>
      <span className="analitica-panel-contract-icon">{icon}</span>
      <span className="analitica-panel-contract-copy">
        <span className="analitica-panel-contract-label">{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </span>
    </div>
  );
}

function ExportReadinessPanel({
  outputs,
  crossConfigLabel,
  nseEnabled,
  suffixPreview,
}: {
  outputs: PanelConfig["outputs"];
  crossConfigLabel: string;
  nseEnabled: boolean;
  suffixPreview: string;
}) {
  const items = [
    {
      key: "codebook",
      active: outputs.codebook,
      icon: <BookOpenCheck size={14} />,
      title: "Libro de códigos",
      detail: "bloques paralelos por medición",
    },
    {
      key: "frecuencias",
      active: outputs.frecuencias,
      icon: <Table2 size={14} />,
      title: "Frecuencias",
      detail: "tablas univariadas estándar",
    },
    {
      key: "cruces",
      active: outputs.cruces,
      icon: <GitMerge size={14} />,
      title: "Cruces",
      detail: crossConfigLabel,
    },
    {
      key: "auditoria",
      active: outputs.auditoria,
      icon: <FileWarning size={14} />,
      title: "Auditoría",
      detail: nseEnabled ? "incluye cobertura NSE" : "sin cobertura NSE",
    },
    {
      key: "base",
      active: true,
      icon: <Database size={14} />,
      title: "Base wide",
      detail: suffixPreview,
    },
    {
      key: "formatos",
      active: true,
      icon: <SlidersHorizontal size={14} />,
      title: "Formatos",
      detail: "Excel, CSV y SPSS",
    },
  ];

  return (
    <div className="analitica-panel-export-summary">
      <div className="analitica-panel-export-summary-head">
        <span className="analitica-control-icon"><ListChecks size={15} /></span>
        <div>
          <strong>Salida longitudinal</strong>
          <small>Archivos independientes, sin ZIP obligatorio.</small>
        </div>
      </div>
      <div className="analitica-panel-export-summary-grid">
        {items.map((item) => (
          <div key={item.key} className={`analitica-panel-export-check ${item.active ? "is-on" : ""}`}>
            <span>{item.active ? <CheckCircle2 size={13} /> : item.icon}</span>
            <div>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DenseTable({ columns, rows }: { columns: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <div className="analitica-panel-table-wrap">
      <table className="analitica-panel-table">
        <thead>
          <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DenseObjectTable({ rows, maxCols = 7 }: { rows: object[]; maxCols?: number }) {
  if (!rows.length) return <EmptyPanelState icon={<Rows3 size={16} />} label="Sin filas para mostrar." />;
  const columns = Object.keys(rows[0] as Record<string, unknown>).slice(0, maxCols);
  return (
    <div className="analitica-panel-table-wrap">
      <table className="analitica-panel-table">
        <thead>
          <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col}>{formatCell((row as Record<string, unknown>)[col])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (typeof value === "number") return Number.isInteger(value) ? value : value.toFixed(3);
  return String(value);
}

function EmptyPanelState({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="analitica-empty analitica-panel-empty">
      <span className="analitica-empty-icon" aria-hidden="true">
        {icon}
      </span>
      <strong>{label}</strong>
      <small>Revisa la configuración o previsualiza de nuevo.</small>
    </div>
  );
}

const MULTI_SELECT_OPTIONS: Array<[string, string]> = [
  ["dummy_01", "Dummies 0/1"],
  ["etiquetas_unidas", "Etiquetas unidas"],
  ["codigos_crudos", "Codigos crudos"],
];

function PanelExportCard({
  icon,
  title,
  copy,
  children,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <div className="analitica-panel-format-card">
      <div className="analitica-panel-format-head">
        <span className="analitica-control-icon">{icon}</span>
        <span>
          <strong>{title}</strong>
          <small>{copy}</small>
        </span>
      </div>
      <div className="analitica-panel-format-controls">
        {children}
      </div>
    </div>
  );
}

function MiniSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="analitica-panel-mini-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function ToggleOutput({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className={`analitica-control-card analitica-option-card ${checked ? "is-active" : ""}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="analitica-control-icon">{checked ? <CheckCircle2 size={15} /> : <BookOpenCheck size={15} />}</span>
      <span>
        <span className="analitica-control-title">{label}</span>
        <span className="analitica-control-copy">Disponible para generar.</span>
      </span>
    </label>
  );
}
