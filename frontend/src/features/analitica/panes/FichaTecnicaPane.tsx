import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  FileText,
  Gauge,
  RefreshCw,
  Sparkles,
  Table2,
  Wand2,
} from "lucide-react";
import {
  AnaliticaFichaTecnicaField,
  AnaliticaFichaTecnicaInfo,
  apiAnaliticaConfigPut,
  apiAnaliticaFichaTecnicaExport,
  apiAnaliticaFichaTecnicaInfo,
} from "../../../api/client";
import { Alert } from "../../../components/Alert";
import { Panel } from "../../../components/Panel";
import { LoadingBlock } from "../../../components/States";
import { GenerateFooter, Section } from "../PaneKit";
import { type FichaTecnicaConfig, useAnaliticaStore } from "../store";
import { useReporteRun } from "../useReporteRun";

type FichaLayout = NonNullable<FichaTecnicaConfig["layout"]>;

const LAYOUTS: Array<{ key: FichaLayout; label: string }> = [
  { key: "pulso_oficial", label: "Pulso" },
  { key: "template", label: "Plantilla" },
  { key: "simple", label: "Simple" },
];

export function FichaTecnicaPane() {
  const config = useAnaliticaStore((s) => s.config);
  const ficha = useAnaliticaStore((s) => s.config.ficha_tecnica);
  const setFichaTecnica = useAnaliticaStore((s) => s.setFichaTecnica);
  const run = useReporteRun();
  const [info, setInfo] = useState<AnaliticaFichaTecnicaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadInfo() {
    setLoading(true);
    setError("");
    try {
      const out = await apiAnaliticaFichaTecnicaInfo();
      setInfo(out);
      if (!ficha.layout && out.layout) {
        setFichaTecnica({ layout: out.layout as FichaLayout });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fields = info?.fields ?? [];
  const fieldsByGroup = useMemo(() => {
    const grouped = new Map<string, AnaliticaFichaTecnicaField[]>();
    for (const field of fields) {
      const group = field.group || "Ficha";
      grouped.set(group, [...(grouped.get(group) ?? []), field]);
    }
    return Array.from(grouped.entries());
  }, [fields]);

  const suggestedCount = fields.filter((field) => {
    const current = fieldValue(ficha, field).trim();
    const suggested = (field.suggested ?? "").trim();
    return suggested && suggested !== current;
  }).length;
  const completedCount = fields.filter((field) => fieldValue(ficha, field).trim()).length;
  const sourceCount = (info?.sources ?? []).filter((source) => source.available).length;
  const tableCount = (info?.tables?.subtables?.length ?? 0) + (info?.tables?.appendices?.length ?? 0);

  function updateField(field: AnaliticaFichaTecnicaField, value: string) {
    setFichaTecnica({ [field.key]: value } as Partial<FichaTecnicaConfig>);
  }

  function applySuggestion(field: AnaliticaFichaTecnicaField) {
    const suggested = (field.suggested ?? "").trim();
    if (!suggested) return;
    updateField(field, suggested);
  }

  function applyEmptySuggestions() {
    const patch: Record<string, string> = {};
    for (const field of fields) {
      if (fieldValue(ficha, field).trim()) continue;
      const suggested = (field.suggested ?? "").trim();
      if (suggested) patch[field.key] = suggested;
    }
    if (Object.keys(patch).length) {
      setFichaTecnica(patch as Partial<FichaTecnicaConfig>);
    }
  }

  async function onGenerate() {
    const nextConfig = {
      ...config,
      ficha_tecnica: ficha,
    };
    await apiAnaliticaConfigPut(nextConfig);
    await run.runSync(() => apiAnaliticaFichaTecnicaExport(ficha as Record<string, unknown>));
    await loadInfo();
  }

  return (
    <Panel
      eyebrow="Reporte"
      title={<span className="analitica-inline-title"><FileText size={16} /> Ficha técnica</span>}
      hint="Redacta la ficha metodológica con apoyo de Hojas de Ruta, cálculo de muestra y base longitudinal."
    >
      <div className="analitica-report-shell analitica-ficha-workbench">
        {loading ? (
          <LoadingBlock label="Leyendo evidencia metodológica..." />
        ) : error ? (
          <Alert kind="error">{error}</Alert>
        ) : (
          <>
            <div className="analitica-report-overview analitica-report-overview--ficha">
              <FichaStat label="Campos completos" value={`${completedCount}/${fields.length || 0}`} />
              <FichaStat label="Sugerencias" value={suggestedCount || "0"} suffix="por revisar" />
              <FichaStat label="Fuentes" value={sourceCount || "0"} suffix="activas" />
              <FichaStat label="Tablas" value={tableCount || "0"} suffix="anexables" />
            </div>

            <div className="analitica-ficha-commandbar">
              <div className="analitica-segmented" role="tablist" aria-label="Formato de ficha">
                {LAYOUTS.map((layout) => (
                  <button
                    key={layout.key}
                    type="button"
                    role="tab"
                    aria-selected={(ficha.layout ?? "pulso_oficial") === layout.key}
                    className={(ficha.layout ?? "pulso_oficial") === layout.key ? "is-on" : undefined}
                    onClick={() => setFichaTecnica({ layout: layout.key })}
                  >
                    {layout.label}
                  </button>
                ))}
              </div>
              <button type="button" className="pulso-secondary" onClick={applyEmptySuggestions} disabled={!suggestedCount}>
                <Wand2 size={14} />
                Completar vacíos
              </button>
              <button type="button" className="pulso-secondary" onClick={loadInfo}>
                <RefreshCw size={14} />
                Actualizar KPIs
              </button>
            </div>

            <div className="analitica-ficha-layout">
              <div className="analitica-ficha-editor">
                {fieldsByGroup.map(([group, groupFields]) => (
                  <Section
                    key={group}
                    title={group}
                    subtitle="Campos editables de la ficha Word. Las sugerencias usan la evidencia disponible del proyecto."
                  >
                    <div className="analitica-ficha-field-list">
                      {groupFields.map((field) => {
                        const value = fieldValue(ficha, field);
                        const suggested = (field.suggested ?? "").trim();
                        const showSuggestion = Boolean(suggested && suggested !== value.trim());
                        return (
                          <label className="analitica-ficha-field" key={field.key}>
                            <span className="analitica-ficha-field-head">
                              <strong>{field.label}</strong>
                              {field.hint && <small>{field.hint}</small>}
                            </span>
                            <textarea
                              className="analitica-ficha-textarea"
                              rows={Math.max(2, field.min_lines ?? 2)}
                              value={value}
                              onChange={(e) => updateField(field, e.target.value)}
                            />
                            {showSuggestion && (
                              <span className="analitica-ficha-suggestion">
                                <span>
                                  <Sparkles size={12} />
                                  {suggested}
                                </span>
                                <button type="button" className="pulso-secondary" onClick={() => applySuggestion(field)}>
                                  Usar
                                </button>
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </Section>
                ))}

                <Section title="Exportar ficha Word" subtitle="La ficha se genera como entregable independiente en DOCX.">
                  <GenerateFooter
                    label="Generar ficha"
                    busy={run.busy}
                    jobId={run.jobId}
                    fileId={run.fileId}
                    downloadName={run.filename ?? "ficha_tecnica.docx"}
                    error={run.error}
                    onGenerate={onGenerate}
                    perBase={run.perBase}
                    onJobDone={run.onJobDone}
                    onJobError={run.onJobError}
                    onJobCancelled={run.onJobCancelled}
                  />
                </Section>
              </div>

              <aside className="analitica-ficha-side" aria-label="Evidencia metodológica">
                <Section title="KPIs metodológicos" subtitle="Lectura automática desde módulos auxiliares disponibles.">
                  {info?.kpis?.length ? (
                    <div className="analitica-ficha-kpi-list">
                      {info.kpis.map((kpi) => (
                        <div className="analitica-ficha-kpi" key={`${kpi.source}-${kpi.label}`}>
                          <span className="analitica-ficha-kpi-icon"><Gauge size={14} /></span>
                          <div>
                            <span>{kpi.source}</span>
                            <strong>{kpi.value}</strong>
                            <small>{kpi.label}{kpi.detail ? ` · ${kpi.detail}` : ""}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="analitica-empty">Sin KPIs automáticos para este proyecto.</div>
                  )}
                </Section>

                <Section title="Fuentes detectadas" subtitle="Contextos que alimentan la redacción sugerida.">
                  <div className="analitica-ficha-source-list">
                    {(info?.sources ?? []).map((source) => (
                      <div className={`analitica-ficha-source ${source.available ? "is-on" : ""}`} key={source.key}>
                        <span>{source.available ? <CheckCircle2 size={13} /> : <BookOpenCheck size={13} />}</span>
                        <div>
                          <strong>{source.label}</strong>
                          <small>{source.detail}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title="Tablas disponibles" subtitle="Se incorporan en el DOCX cuando el formato lo permite.">
                  <div className="analitica-ficha-table-list">
                    {[...(info?.tables?.subtables ?? []), ...(info?.tables?.appendices ?? [])].length ? (
                      [...(info?.tables?.subtables ?? []), ...(info?.tables?.appendices ?? [])].map((name) => (
                        <span key={name}><Table2 size={12} /> {humanizeName(name)}</span>
                      ))
                    ) : (
                      <span>Sin tablas metodológicas detectadas.</span>
                    )}
                  </div>
                </Section>
              </aside>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function fieldValue(ficha: FichaTecnicaConfig, field: AnaliticaFichaTecnicaField) {
  const value = (ficha as Record<string, unknown>)[field.key];
  return typeof value === "string" ? value : field.value ?? "";
}

function humanizeName(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function FichaStat({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="analitica-stat">
      <span className="analitica-stat-label">{label}</span>
      <span className="analitica-stat-value">
        {value}
        {suffix && <small>{suffix}</small>}
      </span>
    </div>
  );
}
