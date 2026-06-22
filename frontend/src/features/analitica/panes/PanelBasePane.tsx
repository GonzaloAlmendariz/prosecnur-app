import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  BookOpenCheck,
  Database,
  FileSpreadsheet,
  FileText,
  FileWarning,
  GitMerge,
  KeyRound,
  Rows3,
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
import { useAnaliticaStore } from "../store";
import { useReporteRun } from "../useReporteRun";

type PanelView = "estructura" | "variables" | "nse" | "auditoria" | "exportar";

const VIEWS: Array<{ key: PanelView; label: string }> = [
  { key: "estructura", label: "Estructura" },
  { key: "variables", label: "Variables" },
  { key: "nse", label: "NSE" },
  { key: "auditoria", label: "Auditoria" },
  { key: "exportar", label: "Exportar" },
];

export function PanelBasePane() {
  const panel = useAnaliticaStore((s) => s.config.panel);
  const setPanel = useAnaliticaStore((s) => s.setPanel);
  const setPanelWave = useAnaliticaStore((s) => s.setPanelWave);
  const packageRun = useReporteRun();
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
      const exists = panel.waves.some((w) => w.base === wave.base);
      if (!exists) {
        setPanelWave(wave.base, {
          base: wave.base,
          label: wave.label,
          suffix: wave.suffix,
          order: wave.order,
        });
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
      suffix: saved.get(wave.base)?.suffix ?? wave.suffix,
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

  async function onGeneratePackage() {
    await packageRun.runAsync(() => apiAnaliticaPanelExport(activeConfig, { formato: "paquete" }));
  }

  async function onGenerateFichaTecnica() {
    await fichaRun.runSync(() => apiAnaliticaPanelFichaTecnica(activeConfig));
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

  return (
    <Panel
      eyebrow="Reporte"
      title={<span className="analitica-inline-title"><GitMerge size={16} /> Base panel</span>}
      hint="Consolida olas en formato wide y conserva cada variable separada por sufijo."
    >
      <div className="analitica-report-shell analitica-panel-workbench">
        {loading ? (
          <LoadingBlock label="Leyendo olas del estudio..." />
        ) : error ? (
          <Alert kind="error">{error}</Alert>
        ) : (
          <>
            <div className="analitica-report-overview analitica-report-overview--panel">
              <Metric label="Olas" value={info?.n_bases ?? 0} suffix="bases" />
              <Metric label="Llave" value={activeConfig.key || "Pendiente"} compact />
              <Metric label="Personas" value={summary?.n_panel_keys ?? "-"} suffix="keys" />
              <Metric label="Auditoria" value={summary?.n_audit_rows ?? "-"} suffix="filas" />
            </div>

            {!info?.available && (
              <Alert kind="warn">
                {info?.reason || "Base panel requiere al menos dos olas y una llave comun."}
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

            {view === "estructura" && (
              <Section title="Llave y olas" subtitle="La salida conserva una fila por llave y columnas separadas por ola.">
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
                  columns={["Ola", "Base", "Sufijo", "Filas", "Llaves", "Duplicadas", "Vacias"]}
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
              <Section title="Preview wide" subtitle="Primeras filas generadas con la configuracion actual.">
                {!preview ? (
                  <EmptyPanelState icon={<Table2 size={16} />} label="Ejecuta una previsualizacion para ver columnas wide." />
                ) : (
                  <DenseObjectTable rows={preview.preview} maxCols={9} />
                )}
              </Section>
            )}

            {view === "nse" && (
              <Section title="Cobertura NSE" subtitle="El mapeo geografico desde Hojas de Ruta queda pendiente; aqui se audita el NSE ya anexado.">
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
              <Section title="Auditoria panel" subtitle="Duplicados, olas faltantes e inconsistencias por variable.">
                {!preview ? (
                  <EmptyPanelState icon={<FileWarning size={16} />} label="Previsualiza para generar auditoria." />
                ) : preview.audit_preview.length ? (
                  <DenseObjectTable rows={preview.audit_preview} />
                ) : (
                  <EmptyPanelState icon={<BookOpenCheck size={16} />} label="Sin incidencias en la muestra revisada." />
                )}
              </Section>
            )}

            {view === "exportar" && (
              <div className="analitica-panel-export-stack">
                <Section title="Paquete metodologico" subtitle="Incluye base wide, libro de codigos, frecuencias, auditoria y cobertura NSE en un solo XLSX.">
                  <div className="analitica-panel-output-grid">
                    <ToggleOutput
                      label="Libro de codigos"
                      checked={panel.outputs.codebook}
                      onChange={(next) => setPanel({ outputs: { ...panel.outputs, codebook: next } })}
                    />
                    <ToggleOutput
                      label="Frecuencias"
                      checked={panel.outputs.frecuencias}
                      onChange={(next) => setPanel({ outputs: { ...panel.outputs, frecuencias: next } })}
                    />
                    <ToggleOutput
                      label="Auditoria"
                      checked={panel.outputs.auditoria}
                      onChange={(next) => setPanel({ outputs: { ...panel.outputs, auditoria: next } })}
                    />
                    <ToggleOutput
                      label="Cobertura NSE"
                      checked={panel.outputs.cobertura_nse}
                      onChange={(next) => setPanel({ outputs: { ...panel.outputs, cobertura_nse: next } })}
                    />
                  </div>
                  <GenerateFooter
                    label="Generar paquete panel"
                    busy={packageRun.busy}
                    jobId={packageRun.jobId}
                    fileId={packageRun.fileId}
                    downloadName={packageRun.filename ?? "base_panel.xlsx"}
                    error={packageRun.error}
                    onGenerate={onGeneratePackage}
                    disabled={disabled}
                    disabledHint={disabled ? (info?.reason || "Selecciona una llave valida para todas las olas.") : undefined}
                    perBase={packageRun.perBase}
                    onJobDone={packageRun.onJobDone}
                    onJobError={packageRun.onJobError}
                    onJobCancelled={packageRun.onJobCancelled}
                  />
                </Section>

                <Section title="Ficha tecnica Word" subtitle="Genera la ficha tecnica metodologica en DOCX usando la plantilla configurada para Prosecnur.">
                  <GenerateFooter
                    label="Generar ficha Word"
                    busy={fichaRun.busy}
                    jobId={fichaRun.jobId}
                    fileId={fichaRun.fileId}
                    downloadName={fichaRun.filename ?? "ficha_tecnica_panel.docx"}
                    error={fichaRun.error}
                    onGenerate={onGenerateFichaTecnica}
                    disabled={disabled}
                    disabledHint={disabled ? (info?.reason || "Selecciona una llave valida para todas las olas.") : undefined}
                    perBase={fichaRun.perBase}
                    onJobDone={fichaRun.onJobDone}
                    onJobError={fichaRun.onJobError}
                    onJobCancelled={fichaRun.onJobCancelled}
                    variant="secondary"
                  />
                </Section>

                <Section title="Base wide por formato" subtitle="Exporta solo el dataset panel con la misma logica de Bases: etiquetas, multi-respuesta y metadatos SPSS.">
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
                          ["codigos", "Codigos"],
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
                        disabledHint={disabled ? (info?.reason || "Selecciona una llave valida para todas las olas.") : undefined}
                        perBase={xlsxRun.perBase}
                        onJobDone={xlsxRun.onJobDone}
                        onJobError={xlsxRun.onJobError}
                        onJobCancelled={xlsxRun.onJobCancelled}
                      />
                    </PanelExportCard>

                    <PanelExportCard
                      icon={<FileText size={15} />}
                      title="CSV wide"
                      copy="Archivo plano UTF-8 con codigos o etiquetas y separador configurable."
                    >
                      <MiniSelect
                        label="Contenido"
                        value={panel.formatos.csv.valores}
                        onChange={(value) => setPanel({ formatos: { ...panel.formatos, csv: { ...panel.formatos.csv, valores: value as "codigos" | "etiquetas" } } })}
                        options={[
                          ["etiquetas", "Etiquetas"],
                          ["codigos", "Codigos"],
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
                        disabledHint={disabled ? (info?.reason || "Selecciona una llave valida para todas las olas.") : undefined}
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
                        disabledHint={disabled ? (info?.reason || "Selecciona una llave valida para todas las olas.") : undefined}
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
      {icon}
      <span>{label}</span>
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
      <span className="analitica-control-icon"><BookOpenCheck size={15} /></span>
      <span>
        <span className="analitica-control-title">{label}</span>
        <span className="analitica-control-copy">Incluido en el Excel panel.</span>
      </span>
    </label>
  );
}
