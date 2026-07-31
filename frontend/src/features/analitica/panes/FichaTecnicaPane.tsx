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
import { GlidingTabList } from "../../../components/GlidingTabList";
import { Panel } from "../../../components/Panel";
import { GenerateFooter, Section } from "../PaneKit";
import { type FichaTecnicaConfig, useAnaliticaStore } from "../store";
import { useReporteRun } from "../useReporteRun";

type FichaLayout = NonNullable<FichaTecnicaConfig["layout"]>;

const LAYOUTS: Array<{ key: FichaLayout; label: string }> = [
  { key: "pulso_oficial", label: "Pulso" },
  { key: "template", label: "Plantilla" },
  { key: "simple", label: "Simple" },
];

let fichaTecnicaInfoInflight: Promise<AnaliticaFichaTecnicaInfo> | null = null;

function fetchFichaTecnicaInfo(force = false) {
  if (!force && fichaTecnicaInfoInflight) return fichaTecnicaInfoInflight;
  fichaTecnicaInfoInflight = apiAnaliticaFichaTecnicaInfo()
    .finally(() => {
      fichaTecnicaInfoInflight = null;
    });
  return fichaTecnicaInfoInflight;
}

export function FichaTecnicaPane() {
  const config = useAnaliticaStore((s) => s.config);
  const ficha = useAnaliticaStore((s) => s.config.ficha_tecnica);
  const setFichaTecnica = useAnaliticaStore((s) => s.setFichaTecnica);
  const run = useReporteRun();
  const [info, setInfo] = useState<AnaliticaFichaTecnicaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [error, setError] = useState("");

  async function loadInfo(force = false) {
    setLoading(true);
    setLoadingSlow(false);
    setError("");
    try {
      const out = await fetchFichaTecnicaInfo(force);
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

  useEffect(() => {
    if (!loading) {
      setLoadingSlow(false);
      return undefined;
    }
    const handle = window.setTimeout(() => setLoadingSlow(true), 4500);
    return () => window.clearTimeout(handle);
  }, [loading]);

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
  const fichaStats: Array<{ label: string; value: string | number; suffix?: string }> = loading
    ? [
        { label: "Campos", value: "Leyendo" },
        { label: "Sugerencias", value: "Armando" },
        { label: "Fuentes", value: "Cruzando" },
        { label: "Tablas", value: "Buscando" },
      ]
    : [
        { label: "Campos completos", value: `${completedCount}/${fields.length || 0}` },
        { label: "Sugerencias", value: suggestedCount || "0", suffix: "por revisar" },
        { label: "Fuentes", value: sourceCount || "0", suffix: "activas" },
        { label: "Tablas", value: tableCount || "0", suffix: "anexables" },
      ];

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
    await loadInfo(true);
  }

  return (
    <Panel className="analitica-ficha-panel">
      <div className="analitica-report-shell analitica-ficha-workbench">
        <div className="analitica-ficha-docbar">
          <span className="analitica-ficha-docbar-icon" aria-hidden="true">
            <FileText size={16} />
          </span>
          <div className="analitica-ficha-docbar-copy">
            <span>Producto metodológico</span>
            <strong>Ficha técnica</strong>
            <small>Resume diseño, muestra, fuentes y base longitudinal en un documento editable.</small>
          </div>
          <div className="analitica-report-overview analitica-report-overview--ficha">
            {fichaStats.map((stat) => (
              <FichaStat key={stat.label} {...stat} />
            ))}
          </div>
        </div>

        {loading ? (
          <FichaLoadingState slow={loadingSlow} />
        ) : error ? (
          <Alert kind="error">{error}</Alert>
        ) : (
          <>
            <div className="analitica-ficha-commandbar">
              <GlidingTabList
                activeKey={ficha.layout ?? "pulso_oficial"}
                mode="tabs"
                className="analitica-segmented"
                role="radiogroup"
                aria-label="Formato de ficha"
                onRovingKeyChange={(key) => {
                  const layout = LAYOUTS.find((candidate) => candidate.key === key);
                  if (layout) setFichaTecnica({ layout: layout.key });
                }}
              >
                {LAYOUTS.map((layout) => (
                  <button
                    key={layout.key}
                    type="button"
                    role="radio"
                    aria-checked={(ficha.layout ?? "pulso_oficial") === layout.key}
                    data-gliding-key={layout.key}
                    className={(ficha.layout ?? "pulso_oficial") === layout.key ? "is-on" : undefined}
                    onClick={() => setFichaTecnica({ layout: layout.key })}
                  >
                    {layout.label}
                  </button>
                ))}
              </GlidingTabList>
              <button type="button" className="pulso-secondary" onClick={applyEmptySuggestions} disabled={!suggestedCount}>
                <Wand2 size={14} />
                Completar sugeridos
              </button>
              <button type="button" className="pulso-secondary" onClick={() => void loadInfo(true)}>
                <RefreshCw size={14} />
                Actualizar evidencia
              </button>
            </div>

            <div className="analitica-ficha-layout">
              <div className="analitica-ficha-editor">
                {fieldsByGroup.map(([group, groupFields]) => (
                  <Section
                    key={group}
                    title={group}
                    subtitle={`${groupFields.length} ${groupFields.length === 1 ? "campo editable" : "campos editables"} para el documento Word. Las sugerencias usan la evidencia disponible del proyecto.`}
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

                <Section title="Exportar ficha" subtitle="La ficha se genera como documento Word independiente.">
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
                <Section title="Indicadores metodológicos" subtitle="Lectura automática desde las fuentes disponibles del proyecto.">
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
                    <div className="analitica-empty">
                      <span className="analitica-empty-icon" aria-hidden="true">
                        <Gauge size={15} />
                      </span>
                      <strong>Sin indicadores automáticos</strong>
                      <small>Los indicadores aparecerán cuando haya evidencia disponible.</small>
                    </div>
                  )}
                </Section>

                <Section title="Fuentes de evidencia" subtitle="Contextos que alimentan la redacción sugerida.">
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

                <Section title="Tablas para anexar" subtitle="Se incorporan al Word cuando el formato lo permite.">
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

function FichaLoadingState({ slow }: { slow: boolean }) {
  const steps = [
    { icon: BookOpenCheck, label: "Fuentes", detail: "Hojas de Ruta y metadatos" },
    { icon: Gauge, label: "Indicadores", detail: "Resumen metodológico" },
    { icon: Table2, label: "Tablas", detail: "Anexos disponibles" },
  ];

  return (
    <div className={`analitica-ficha-loading${slow ? " is-slow" : ""}`} role="status" aria-live="polite">
      <section className="analitica-ficha-loading-hero" aria-label="Preparando ficha técnica">
        <span className="analitica-ficha-loading-icon" aria-hidden="true">
          <FileText size={18} />
        </span>
        <div className="analitica-ficha-loading-copy">
          <span>{slow ? "Lectura extendida" : "Lectura metodológica"}</span>
          <h3>{slow ? "Seguimos armando la ficha técnica" : "Preparando evidencia de ficha técnica"}</h3>
          <p>
            {slow
              ? "Los proyectos con varias bases requieren cruzar Hojas de Ruta, muestra y tablas antes de abrir el editor."
              : "Estamos leyendo configuración, muestra, base longitudinal y tablas disponibles."}
          </p>
        </div>
      </section>

      {slow && (
        <div className="analitica-ficha-loading-note">
          <span aria-hidden="true">
            <RefreshCw size={13} />
          </span>
          <div>
            <strong>Evidencia en preparación</strong>
            <small>La ficha se abrirá apenas termine la lectura de fuentes metodológicas.</small>
          </div>
        </div>
      )}

      <div className="analitica-ficha-loading-steps" aria-hidden="true">
        {steps.map(({ icon: Icon, label, detail }) => (
          <div className="analitica-ficha-loading-step" key={label}>
            <span><Icon size={14} /></span>
            <div>
              <strong>{label}</strong>
              <small>{detail}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="analitica-ficha-loading-grid" aria-hidden="true">
        <div className="analitica-ficha-loading-editor">
          <i className="analitica-ficha-loading-line is-title" />
          <i className="analitica-ficha-loading-line" />
          <i className="analitica-ficha-loading-block" />
          <i className="analitica-ficha-loading-line is-short" />
          <i className="analitica-ficha-loading-block is-soft" />
        </div>
        <div className="analitica-ficha-loading-side">
          <i className="analitica-ficha-loading-line is-title" />
          <i className="analitica-ficha-loading-pill" />
          <i className="analitica-ficha-loading-pill" />
          <i className="analitica-ficha-loading-pill is-soft" />
        </div>
      </div>
    </div>
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
