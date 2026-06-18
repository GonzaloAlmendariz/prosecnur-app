import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Clock,
  Filter,
  Layers3,
  MapPinned,
  Search,
  ShieldAlert,
  Table2,
  Target,
  Users,
} from "lucide-react";
import { Alert } from "../../../components/Alert";
import { EmptyState, LoadingBlock } from "../../../components/States";
import {
  apiMonitoreoPublicReport,
  type MonitoreoDailyProgressModel,
  type MonitoreoPublicationModel,
  type MonitoreoPublicationSection,
  type MonitoreoPublicReportPayload,
  type MonitoreoRow,
  type PublicArtifactDescriptor,
} from "../../../api/client";
import "./monitoreoPublic.css";

type PublicMetric = {
  label: string;
  value: string;
  hint: string;
  tone?: "base" | "ready" | "warning" | "danger";
};

const norm = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

function rowValue(row: MonitoreoRow | Record<string, unknown> | null | undefined, candidates: string[]) {
  if (!row) return null;
  const wanted = new Set(candidates.map(norm));
  const key = Object.keys(row).find((name) => wanted.has(norm(name)));
  return key ? (row as Record<string, unknown>)[key] : null;
}

function rowNumber(row: MonitoreoRow | Record<string, unknown> | null | undefined, candidates: string[]) {
  const value = rowValue(row, candidates);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/%/g, "").replace(/\s/g, "").replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function rowText(row: MonitoreoRow | Record<string, unknown> | null | undefined, candidates: string[], fallback = "") {
  const value = rowValue(row, candidates);
  if (value == null) return fallback;
  return String(value);
}

function formatMetric(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "S/D";
  return Math.round(value).toLocaleString("es-PE");
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "S/D";
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  return `${pct.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`;
}

function safePercent(part: number | null | undefined, total: number | null | undefined) {
  if (part == null || total == null || !Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null;
  return (part / total) * 100;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  }
  return value;
}

function summaryValue(rows: MonitoreoRow[], label: string) {
  const wanted = norm(label);
  const row = rows.find((item) => norm(rowText(item, ["Indicador"])) === wanted);
  return rowText(row, ["Valor"], "S/D");
}

function metricNumber(rows: MonitoreoRow[], label: string) {
  const raw = summaryValue(rows, label);
  const parsed = Number(String(raw).replace(/%/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export default function MonitoreoPublicReportPage({ artifact }: { artifact: PublicArtifactDescriptor }) {
  const [payload, setPayload] = useState<MonitoreoPublicReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiMonitoreoPublicReport()
      .then((next) => {
        if (!cancelled) setPayload(next);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingBlock label="Cargando reporte de avance..." />;

  if (error) {
    return (
      <section className="mon-public-page">
        <Alert kind="error">{error}</Alert>
      </section>
    );
  }

  if (!payload) {
    return (
      <section className="mon-public-page">
        <EmptyState icon={<BarChart3 size={18} />} title="Sin reporte publicado" hint="El corte publico no contiene un reporte de Monitoreo disponible." />
      </section>
    );
  }

  const title = artifact.title || payload.accreditation?.title || "Reporte de avance";
  const family = payload.profile.family === "territorial" ? "Territorial" : "Acreditacion";

  return (
    <section className="mon-public-page" data-public-artifact="monitoreo">
      <header className="mon-public-header">
        <div>
          <span className="mon-public-kicker">Monitoreo · {family}</span>
          <h1>{title}</h1>
          <p>Corte publicado {formatDate(payload.synced_at || payload.generated_at)}</p>
        </div>
        <div className="mon-public-stamp">
          <span>Alcance</span>
          <strong>{artifact.public_scope === "aggregate" ? "Agregado" : artifact.public_scope}</strong>
          <em>{payload.n_rows ? `${formatMetric(payload.n_rows)} registros fuente` : "Solo lectura"}</em>
        </div>
      </header>

      {payload.publication_model ? (
        <PublicationModelReport payload={payload} model={payload.publication_model} />
      ) : payload.audience === "internal" && payload.internal ? (
        <InternalReport payload={payload} />
      ) : payload.accreditation ? (
        <AccreditationReport payload={payload} />
      ) : payload.territorial ? (
        <TerritorialReport payload={payload} />
      ) : (
        <EmptyState icon={<BarChart3 size={18} />} title="Perfil no disponible" hint="Este reporte publico no tiene un perfil de Monitoreo compatible." />
      )}
    </section>
  );
}

const publicationSectionKeys = [
  "portada",
  "resumen_avance",
  "avance_por_distrito",
  "avance_por_ump",
  "avance_diario",
  "avance_por_responsable",
  "cuotas_resumen",
  "resumen_ejecutivo",
  "avance_general",
  "avance_por_actor",
  "avance_por_segmento",
  "cobertura_pendientes",
  "resumen_operativo",
  "metas_internas_actor",
  "pendientes_por_actor",
  "control_seguimiento",
  "avance_campo",
  "encuestadores_rutas",
  "cuotas_ump",
  "validacion_tiempos",
  "ocurrencias_campo",
  "casos_accionables",
  "gps_territorio",
  "fuentes_actualizacion",
  "auditoria_tecnica",
  "base_tecnica",
] as const;

function isPublicationSection(value: unknown): value is MonitoreoPublicationSection {
  return Boolean(value && typeof value === "object" && typeof (value as MonitoreoPublicationSection).id === "string");
}

function publicationModelSections(model: MonitoreoPublicationModel) {
  const keyed = new Map<string, MonitoreoPublicationSection>();
  publicationSectionKeys.forEach((key) => {
    const section = model[key];
    if (isPublicationSection(section)) {
      keyed.set(key, section);
      keyed.set(norm(section.id), section);
      keyed.set(norm(section.title), section);
    }
  });
  const ordered: MonitoreoPublicationSection[] = [];
  (model.tab_order ?? []).forEach((item) => {
    const section = keyed.get(norm(item));
    if (section && !ordered.some((current) => current.id === section.id)) ordered.push(section);
  });
  publicationSectionKeys.forEach((key) => {
    const section = model[key];
    if (isPublicationSection(section) && !ordered.some((current) => current.id === section.id)) ordered.push(section);
  });
  return ordered;
}

function publicationRows(section: MonitoreoPublicationSection | undefined): MonitoreoRow[] {
  return (section?.rows ?? []).filter((row): row is MonitoreoRow => row != null && typeof row === "object");
}

function publicationColumns(section: MonitoreoPublicationSection | undefined, rows: MonitoreoRow[]) {
  const declared = (section?.columns ?? []).filter(Boolean);
  if (declared.length) return declared.slice(0, 18);
  const seen: string[] = [];
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!seen.includes(key)) seen.push(key);
    });
  });
  return seen.slice(0, 18);
}

function meaningfulRowCount(section: MonitoreoPublicationSection | undefined) {
  const rows = publicationRows(section);
  if (rows.length !== 1) return rows.length;
  const only = rows[0];
  const status = rowText(only, ["Estado"], "");
  return /^sin |no aplica|los casos accionables no se publican/i.test(status) ? 0 : rows.length;
}

function portadaValue(model: MonitoreoPublicationModel, label: string, fallback = "S/D") {
  const wanted = norm(label);
  const row = publicationRows(model.portada).find((item) => norm(rowText(item, ["Campo"])) === wanted);
  return rowText(row, ["Valor"], fallback);
}

function sectionIcon(id: string, size = 15) {
  if (id.includes("avance")) return <Activity size={size} />;
  if (id.includes("encuestadores")) return <Users size={size} />;
  if (id.includes("cuotas")) return <Target size={size} />;
  if (id.includes("tiempos")) return <Clock size={size} />;
  if (id.includes("gps")) return <MapPinned size={size} />;
  if (id.includes("casos") || id.includes("auditoria")) return <ShieldAlert size={size} />;
  if (id.includes("fuentes")) return <CheckCircle2 size={size} />;
  return <Table2 size={size} />;
}

function PublicationModelReport({ payload, model }: { payload: MonitoreoPublicReportPayload; model: MonitoreoPublicationModel }) {
  const sections = useMemo(() => publicationModelSections(model), [model]);
  const [activeId, setActiveId] = useState(sections[1]?.id ?? sections[0]?.id ?? "portada");
  const [query, setQuery] = useState("");
  const active = sections.find((section) => section.id === activeId) ?? sections[0];
  const activeRows = publicationRows(active);
  const filteredRows = useMemo(() => {
    const q = norm(query);
    if (!q) return activeRows;
    return activeRows.filter((row) => norm(Object.values(row).map((value) => String(value ?? "")).join(" ")).includes(q));
  }, [activeRows, query]);
  const metrics = useMemo<PublicMetric[]>(() => {
    const records = Number(portadaValue(model, "Registros", "0").replace(/[^\d.-]/g, ""));
    const warnings = model.audience === "internal" ? meaningfulRowCount(model.casos_accionables) + meaningfulRowCount(model.ocurrencias_campo) : 0;
    return [
      { label: "Registros", value: formatMetric(Number.isFinite(records) ? records : payload.n_rows), hint: "corte publicado", tone: "base" },
      { label: "Estado campo", value: portadaValue(model, "Estado general de campo"), hint: portadaValue(model, "Ultima actualizacion", payload.synced_at), tone: "ready" },
      { label: "Secciones", value: formatMetric(sections.length), hint: model.audience === "internal" ? "libro operativo completo" : "vista segura cliente", tone: "base" },
      { label: model.audience === "internal" ? "Alertas/casos" : "Alcance", value: model.audience === "internal" ? formatMetric(warnings) : "Avance", hint: model.audience === "internal" ? "visibles internamente" : "vista de avance", tone: warnings ? "warning" : "ready" },
    ];
  }, [model, payload.n_rows, payload.synced_at, sections.length]);

  if (!sections.length) {
    return <EmptyState icon={<BarChart3 size={18} />} title="Modelo sin secciones" hint="El corte publicado no contiene tablas operativas." />;
  }

  return (
    <>
      <MetricGrid metrics={metrics} />
      {model.audience === "internal" && (
        <section className="mon-public-private-note">
          <ShieldAlert size={16} />
          <div>
            <strong>Vista interna privada</strong>
            <p>Este Space renderiza datos completos del corte. No hay descargas desde esta interfaz.</p>
          </div>
        </section>
      )}

      <PublicationModelLanding model={model} />

      <section className="mon-public-suite">
        <aside className="mon-public-section-rail" aria-label="Secciones publicadas">
          {sections.map((section) => {
            const count = meaningfulRowCount(section);
            const activeSection = section.id === active?.id;
            return (
              <button
                key={section.id}
                type="button"
                className={activeSection ? "is-active" : ""}
                onClick={() => setActiveId(section.id)}
              >
                <span>{sectionIcon(section.id)} {section.title}</span>
                <strong>{formatMetric(count)}</strong>
              </button>
            );
          })}
        </aside>

        <div className="mon-public-suite-main">
          <div className="mon-public-suite-tools">
            <div>
              <span>{sectionIcon(active?.id ?? "")} Sección activa</span>
              <strong>{active?.title ?? "Sin sección"}</strong>
              <p>{active?.description ?? "Tabla operacional del corte publicado."}</p>
            </div>
            <label className="mon-public-search">
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar filas publicadas" />
            </label>
          </div>

          <section className="mon-public-layout mon-public-layout--suite">
            <PublicationSectionTable section={active} rows={filteredRows} />
            <PublicationInsightPanel model={model} />
          </section>
        </div>
      </section>
    </>
  );
}

function PublicationModelLanding({ model }: { model: MonitoreoPublicationModel }) {
  const family = String(model.family ?? "");
  const isAccreditation = /acreditacion|accreditation/.test(family);
  const isInternal = model.audience === "internal";
  const title = isInternal
    ? "Monitoreo operativo interno"
    : isAccreditation
    ? "Reporte de avance para cliente"
    : "Reporte de avance territorial";
  const hint = isInternal
    ? "Incluye validaciones, ocurrencias y auditoría del corte publicado."
    : isAccreditation
    ? "Cobertura, avance diario y avance por actor."
    : "Avance por distrito, UMP y cuota.";
  const progressRows = isAccreditation
    ? publicationRows(model.avance_por_actor ?? model.avance_por_segmento ?? model.cobertura_pendientes)
    : publicationRows(model.avance_por_distrito ?? model.avance_por_ump ?? model.cuotas_resumen);
  const fallbackRows = isInternal
    ? publicationRows(model.cuotas_ump ?? model.avance_campo ?? model.avance_general)
    : progressRows;
  const rows = progressRows.length ? progressRows : fallbackRows;
  return (
    <section className="mon-public-model-landing" aria-label="Resumen visual del corte">
      <article className="mon-public-model-intro">
        <span><Activity size={14} /> Publicación</span>
        <strong>{title}</strong>
        <p>{hint}</p>
        <dl>
          <div><dt>Familia</dt><dd>{isAccreditation ? "Acreditación" : "Territorial"}</dd></div>
          <div><dt>Audiencia</dt><dd>{isInternal ? "Interna" : "Cliente"}</dd></div>
          <div><dt>Actualización</dt><dd>{portadaValue(model, "Ultima actualizacion", model.synced_at || model.generated_at || "No registrado")}</dd></div>
        </dl>
      </article>
      <PublicationProgressPanel
        title={isAccreditation ? "Avance por actor" : "Avance por distrito"}
        rows={rows}
        labelKeys={isAccreditation ? ["Actor", "Segmento", "Indicador"] : ["Distrito", "distrito", "UMP", "Manzana", "Indicador"]}
        doneKeys={["Efectivas", "Válidas", "Validas", "Casos efectivos", "total"]}
        targetKeys={isAccreditation && !isInternal ? ["Universo", "Total"] : ["Mínimo/meta operativa", "Mínimo/meta", "Minimo/meta", "Referencia operativa", "Meta", "Cuota", "target", "Universo", "Total"]}
        targetLabel={isAccreditation && !isInternal ? "Universo" : "Referencia"}
        percentKeys={isAccreditation && !isInternal ? ["% avance universo", "% cobertura", "% avance", "avance_pct"] : ["% sobre mínimo", "% avance mínimo", "% avance minimo", "% avance universo", "% cobertura", "% avance", "avance_pct", "% cumplimiento"]}
      />
      <PublicationDailyProgress model={model} isAccreditation={isAccreditation} isInternal={isInternal} />
    </section>
  );
}

function PublicationProgressPanel({
  title,
  rows,
  labelKeys,
  doneKeys,
  targetKeys,
  targetLabel = "Meta",
  percentKeys,
}: {
  title: string;
  rows: MonitoreoRow[];
  labelKeys: string[];
  doneKeys: string[];
  targetKeys: string[];
  targetLabel?: string;
  percentKeys: string[];
}) {
  const visible = rows.slice(0, 8);
  return (
    <article className="mon-public-panel mon-public-progress-overview">
      <header className="mon-public-panel-head">
        <div>
          <span><Target size={14} /> Avance</span>
          <strong>{title}</strong>
        </div>
        <em>{rows.length.toLocaleString("es-PE")} filas</em>
      </header>
      {visible.length ? (
        <div className="mon-public-progress-list">
          {visible.map((row, index) => {
            const label = rowText(row, labelKeys, `Grupo ${index + 1}`);
            const done = rowNumber(row, doneKeys);
            const target = rowNumber(row, targetKeys);
            const progress = rowNumber(row, percentKeys) ?? safePercent(done, target) ?? 0;
            const state = rowText(row, ["Estado de avance", "Estado", "Estado de cuota", "Estado general de campo", "Estado interno"], "No disponible");
            return (
              <section key={`${label}-${index}`} className="mon-public-progress-card">
                <header>
                  <strong>{label}</strong>
                  <span>{formatPercent(progress)}</span>
                </header>
                <div className="mon-public-meter"><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
                <dl>
                  <div><dt>Avance</dt><dd>{formatMetric(done)}</dd></div>
                  <div><dt>{targetLabel}</dt><dd>{formatMetric(target)}</dd></div>
                  <div><dt>Estado</dt><dd>{state}</dd></div>
                </dl>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<Target size={18} />} title="Sin avance desagregado" hint="No disponible para este corte." variant="inline" />
      )}
    </article>
  );
}

function dailyProgressRows(rows: MonitoreoRow[] | undefined) {
  return Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object") : [];
}

function referenceNumber(reference: MonitoreoDailyProgressModel["target_reference"]) {
  if (!reference) return null;
  const value = reference.value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/%/g, "").replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dailyEmpty(progress: MonitoreoDailyProgressModel | undefined, key: string, fallback: string) {
  return progress?.empty_state?.[key] || fallback;
}

function PublicationDailyProgress({ model, isAccreditation, isInternal }: { model: MonitoreoPublicationModel; isAccreditation: boolean; isInternal: boolean }) {
  const progress = model.daily_progress;
  if (!progress) {
    return (
      <DailyChart
        title="Evolución diaria"
        rows={publicationRows(model.avance_diario)}
        totalKeys={["UMP efectivas acumuladas", "Efectivas acumuladas", "Total respuestas", "total", "Efectivas", "Nuevas UMP efectivas", "Nuevas efectivas", "Validas", "Válidas"]}
        doneKeys={["Nuevas UMP efectivas", "Nuevas efectivas", "Efectivas", "Validas", "Válidas"]}
        pendingKeys={["Pendientes"]}
        warningKeys={[]}
        dateKeys={["Fecha etiqueta", "Fecha", "date_label", "date"]}
      />
    );
  }
  return (
    <section className="mon-public-daily-progress" aria-label="Visualizaciones de avance diario">
      <header className="mon-public-daily-progress-head">
        <div>
          <span><CalendarRange size={14} /> Avance diario</span>
          <strong>Visualización diaria y acumulada</strong>
        </div>
        <em>{isAccreditation ? "Acreditación" : "Territorial"}</em>
      </header>
      <div className="mon-public-daily-progress-grid">
        <DailyStatusBars progress={progress} />
        <DailyEffectiveBars progress={progress} />
        <DailyCumulativeLine progress={progress} />
        <DailyBreakdownTable progress={progress} isAccreditation={isAccreditation} isInternal={isInternal} />
      </div>
    </section>
  );
}

function DailyStatusBars({ progress }: { progress: MonitoreoDailyProgressModel }) {
  const rows = dailyProgressRows(progress.by_date_status);
  const palette = progress.status_palette ?? {};
  const dates = Array.from(new Set(rows.map((row) => rowText(row, ["Fecha"], "")).filter(Boolean))).slice(0, 14);
  if (!rows.length || !dates.length) {
    return (
      <article className="mon-public-panel mon-public-daily-card">
        <header className="mon-public-panel-head"><div><span><BarChart3 size={14} /> Estado</span><strong>Avance por estado</strong></div></header>
        <EmptyState icon={<BarChart3 size={18} />} title="Sin estados diarios" hint={dailyEmpty(progress, "status", "No hay estados normalizados disponibles.")} variant="inline" />
      </article>
    );
  }
  return (
    <article className="mon-public-panel mon-public-daily-card" data-chart="daily-status">
      <header className="mon-public-panel-head">
        <div><span><BarChart3 size={14} /> Estado</span><strong>Avance por estado</strong></div>
        <em>{dates.length.toLocaleString("es-PE")} días</em>
      </header>
      <div className="mon-public-status-bars">
        {dates.map((date) => {
          const dayRows = rows.filter((row) => rowText(row, ["Fecha"], "") === date);
          const total = Math.max(1, dayRows.reduce((sum, row) => sum + (rowNumber(row, ["Casos"]) ?? 0), 0));
          const label = rowText(dayRows[0] ?? {}, ["Fecha etiqueta", "Fecha"], date);
          return (
            <section key={date} className="mon-public-status-day">
              <span>{formatDate(label)}</span>
              <div className="mon-public-stacked-bar">
                {dayRows.map((row, index) => {
                  const status = rowText(row, ["Estado"], "Sin clasificación");
                  const value = rowNumber(row, ["Casos"]) ?? 0;
                  return (
                    <i
                      key={`${status}-${index}`}
                      title={`${status}: ${formatMetric(value)}`}
                      style={{ width: `${Math.max(0, (value / total) * 100)}%`, background: palette[status] || "#64748b" }}
                    />
                  );
                })}
              </div>
              <strong>{formatMetric(total)}</strong>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function DailyEffectiveBars({ progress }: { progress: MonitoreoDailyProgressModel }) {
  const rows = dailyProgressRows(progress.daily_effective).slice(0, 18);
  const valueKeys = ["Nuevas UMP efectivas", "Nuevas efectivas", "Efectivas"];
  const hasUmp = rows.some((row) => rowValue(row, ["Nuevas UMP efectivas"]) != null);
  const max = Math.max(1, ...rows.map((row) => rowNumber(row, valueKeys) ?? 0));
  return (
    <article className="mon-public-panel mon-public-daily-card" data-chart="daily-effective">
      <header className="mon-public-panel-head">
        <div><span><Activity size={14} /> Diario</span><strong>{hasUmp ? "Nuevas UMP efectivas" : "Nuevas efectivas"}</strong></div>
        <em>{rows.length.toLocaleString("es-PE")} días</em>
      </header>
      {rows.length ? (
        <div className="mon-public-daily">
          {rows.map((row, index) => {
            const value = rowNumber(row, valueKeys) ?? 0;
            const date = rowText(row, ["Fecha etiqueta", "Fecha"], "Sin fecha");
            return (
              <div key={`${date}-${index}`} className="mon-public-daily-row">
                <span>{formatDate(date)}</span>
                <div className="mon-public-daily-bar" aria-label={`${date}: ${value} efectivas`}>
                  <i className="is-done" style={{ width: `${Math.max(0, (value / max) * 100)}%` }} />
                </div>
                <strong>{formatMetric(value)}</strong>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<Clock size={18} />} title="Sin serie diaria" hint={dailyEmpty(progress, "date", "No hay fecha disponible para construir evolución diaria.")} variant="inline" />
      )}
    </article>
  );
}

function DailyCumulativeLine({ progress }: { progress: MonitoreoDailyProgressModel }) {
  const rows = dailyProgressRows(progress.cumulative_effective).slice(0, 24);
  const cumulativeKeys = ["UMP efectivas acumuladas", "Efectivas acumuladas", "Acumulado"];
  const values = rows.map((row) => rowNumber(row, cumulativeKeys) ?? 0);
  const rowTarget = rows.length ? rowNumber(rows[0], ["Meta UMP", "Meta/referencia", "Universo", "Referencia operativa"]) : null;
  const target = rowTarget ?? referenceNumber(progress.target_reference);
  const max = Math.max(1, target ?? 0, ...values);
  const points = values.map((value, index) => {
    const x = values.length <= 1 ? 50 : 6 + (index / Math.max(1, values.length - 1)) * 88;
    const y = 90 - (Math.max(0, value) / max) * 76;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const lastPoint = points.split(" ").at(-1)?.split(",").map(Number) ?? [50, 90];
  const targetY = target != null && target > 0 ? 90 - (target / max) * 76 : null;
  const lastRows = rows.slice(-3);
  return (
    <article className="mon-public-panel mon-public-daily-card" data-chart="cumulative-progress">
      <header className="mon-public-panel-head">
        <div><span><Target size={14} /> Acumulado</span><strong>Evolución acumulada</strong></div>
        <em>{target != null && target > 0 ? `${progress.target_reference?.label ?? "Referencia"} ${formatMetric(target)}` : dailyEmpty(progress, "target", "No hay referencia de avance configurada.")}</em>
      </header>
      {rows.length ? (
        <>
          <svg className="mon-public-line-chart" viewBox="0 0 100 100" role="img" aria-label="Avance acumulado">
            {targetY != null && <line x1="4" x2="96" y1={targetY} y2={targetY} className="target-line" />}
            <polyline points={points} />
            <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2.6" />
          </svg>
          <div className="mon-public-chart-foot">
            {lastRows.map((row, index) => (
              <small key={`${rowText(row, ["Fecha"], "")}-${index}`}>
                <span>{formatDate(rowText(row, ["Fecha etiqueta", "Fecha"], ""))}</span>
                <strong>{formatMetric(rowNumber(row, cumulativeKeys))}</strong>
              </small>
            ))}
          </div>
        </>
      ) : (
        <EmptyState icon={<Target size={18} />} title="Sin acumulado" hint={dailyEmpty(progress, "general", "No hay datos suficientes para este gráfico.")} variant="inline" />
      )}
    </article>
  );
}

function DailyBreakdownTable({ progress, isAccreditation, isInternal }: { progress: MonitoreoDailyProgressModel; isAccreditation: boolean; isInternal: boolean }) {
  const rows = (isAccreditation
    ? [...dailyProgressRows(progress.by_date_actor), ...dailyProgressRows(progress.by_date_segment)]
    : [...dailyProgressRows(progress.by_date_district), ...dailyProgressRows(progress.by_date_ump)]
  ).slice(0, 12);
  const columns = (isAccreditation
    ? ["Fecha", "Actor", "Segmento", "Nuevas efectivas", "Efectivas acumuladas", ...(isInternal ? ["% avance mínimo", "% sobre mínimo acumulado", "Brecha", "Brecha contra mínimo"] : ["% avance universo", "% avance universo acumulado", "Pendientes"])]
    : ["Fecha etiqueta", "Distrito", "UMP", "Nuevas UMP efectivas", "UMP efectivas acumuladas", "% avance cuota", "Brecha"]
  ).filter((column) => rows.some((row) => rowValue(row, [column]) != null));
  return (
    <article className="mon-public-panel mon-public-daily-card mon-public-daily-card--wide" data-chart="daily-actor-unit">
      <header className="mon-public-panel-head">
        <div><span><Table2 size={14} /> Desagregado</span><strong>{isAccreditation ? "Avance por actor/segmento" : "Avance por distrito/UMP"}</strong></div>
        <em>{rows.length.toLocaleString("es-PE")} filas</em>
      </header>
      {rows.length && columns.length ? (
        <div className="mon-public-table-wrap mon-public-table-wrap--compact">
          <table className="mon-public-table">
            <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>{columns.map((column) => <td key={column}>{rowText(row, [column], "")}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={<Table2 size={18} />} title="Sin desagregado diario" hint={dailyEmpty(progress, "general", "No hay datos suficientes para este gráfico.")} variant="inline" />
      )}
    </article>
  );
}

function PublicationSectionTable({ section, rows }: { section?: MonitoreoPublicationSection; rows: MonitoreoRow[] }) {
  const columns = publicationColumns(section, rows);
  const visible = rows.slice(0, 220);
  return (
    <article className="mon-public-panel mon-public-panel--model">
      <header className="mon-public-panel-head">
        <div>
          <span><Filter size={14} /> Tabla</span>
          <strong>{section?.title ?? "Tabla operativa"}</strong>
        </div>
        <em>{rows.length.toLocaleString("es-PE")} filas</em>
      </header>
      {visible.length ? (
        <div className="mon-public-table-wrap mon-public-table-wrap--model">
          <table className="mon-public-table">
            <thead>
              <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => <td key={column}>{rowText(row, [column], "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={<CheckCircle2 size={18} />} title="Sin filas para mostrar" hint="La sección está vacía o el filtro no encontró coincidencias." variant="inline" />
      )}
      {rows.length > visible.length && <p className="mon-public-table-note">Mostrando las primeras {visible.length.toLocaleString("es-PE")} filas para mantener el Space ágil.</p>}
    </article>
  );
}

function PublicationInsightPanel({ model }: { model: MonitoreoPublicationModel }) {
  const family = String(model.family ?? "");
  const sources = publicationRows(model.fuentes_actualizacion);
  const isAccreditation = /acreditacion|accreditation/.test(family);
  const isInternal = model.audience === "internal";
  const quotaRows = publicationRows(model.cuotas_ump ?? model.cuotas_resumen);
  const gpsRows = publicationRows(model.gps_territorio);
  const actorRows = publicationRows(model.avance_por_actor);
  const dailyRows = publicationRows(model.avance_diario);
  const segmentRows = publicationRows(model.avance_por_segmento);
  const completedQuota = quotaRows.filter((row) => /completa|mínimo alcanzado/i.test(rowText(row, ["Estado de cuota", "Estado"], ""))).length;
  const gpsWarnings = gpsRows.filter((row) => /revision|fuera|no defendible|sin gps/i.test(Object.values(row).join(" "))).length;
  if (isAccreditation && !isInternal) {
    return (
      <aside className="mon-public-insights">
        <article>
          <span><Users size={14} /> Actores</span>
          <strong>{formatMetric(actorRows.length)}</strong>
          <p>Actores incluidos en el avance publicado.</p>
        </article>
        <article>
          <span><CalendarRange size={14} /> Avance diario</span>
          <strong>{formatMetric(dailyRows.length)}</strong>
          <p>Filas de avance diario general o por actor.</p>
        </article>
        <article>
          <span><Layers3 size={14} /> Segmentos</span>
          <strong>{formatMetric(segmentRows.length)}</strong>
          <p>Segmentos institucionales con avance publicable.</p>
        </article>
        <article>
          <span><CheckCircle2 size={14} /> Fuentes</span>
          <strong>{formatMetric(sources.length)}</strong>
          <p>Fuentes y actualización agregadas en el corte.</p>
        </article>
      </aside>
    );
  }
  return (
    <aside className="mon-public-insights">
      {quotaRows.length > 0 && (
        <article>
          <span><Target size={14} /> Cuotas</span>
          <strong>{formatMetric(completedQuota)}</strong>
          <p>Unidades completas o sobre el mínimo en {formatMetric(quotaRows.length)} filas publicadas.</p>
        </article>
      )}
      {isInternal && gpsRows.length > 0 && (
        <article>
          <span><MapPinned size={14} /> GPS/territorio</span>
          <strong>{formatMetric(gpsWarnings)}</strong>
          <p>Filas con señales de revisión territorial en la sección GPS.</p>
        </article>
      )}
      <article>
        <span><CheckCircle2 size={14} /> Fuentes</span>
        <strong>{formatMetric(sources.length)}</strong>
        <p>Fuentes, campos o trazas de actualización incluidos en el corte.</p>
      </article>
      {isInternal && gpsRows.length > 0 && <PublicationMiniMap rows={gpsRows} />}
    </aside>
  );
}

function PublicationMiniMap({ rows }: { rows: MonitoreoRow[] }) {
  const points = rows
    .map((row) => ({
      lat: rowNumber(row, ["lat", "latitude"]),
      lon: rowNumber(row, ["lon", "lng", "longitude"]),
      status: rowText(row, ["geo_estado", "Estado GPS", "Estado"], ""),
    }))
    .filter((point): point is { lat: number; lon: number; status: string } => (
      point.lat != null && point.lon != null && Number.isFinite(point.lat) && Number.isFinite(point.lon)
    ))
    .slice(0, 180);
  if (!points.length) {
    const groups = rows.slice(0, 8).map((row, index) => (
      <li key={index}><span>{rowText(row, ["Estado GPS", "geo_estado", "Bloque", "Estado"], "Resumen")}</span><strong>{formatMetric(rowNumber(row, ["Casos", "Registros", "Ocurrencias"]))}</strong></li>
    ));
    return (
      <article className="mon-public-mini-map">
        <span><MapPinned size={14} /> Mapa</span>
        <strong>Resumen agregado</strong>
        <ul>{groups.length ? groups : <li><span>Sin GPS publicable</span><strong>S/D</strong></li>}</ul>
      </article>
    );
  }
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const spanLat = Math.max(0.0001, maxLat - minLat);
  const spanLon = Math.max(0.0001, maxLon - minLon);
  return (
    <article className="mon-public-mini-map">
      <span><MapPinned size={14} /> Mapa</span>
      <strong>{formatMetric(points.length)} puntos GPS</strong>
      <div className="mon-public-map-canvas" aria-label="Distribucion GPS publicada">
        {points.map((point, index) => {
          const left = ((point.lon - minLon) / spanLon) * 88 + 6;
          const top = 94 - (((point.lat - minLat) / spanLat) * 88 + 6);
          const tone = /no_defendible|fuera|revision|sin_gps/i.test(point.status) ? "is-warning" : "is-ok";
          return <i key={index} className={tone} style={{ left: `${left}%`, top: `${top}%` }} />;
        })}
      </div>
    </article>
  );
}

function MetricGrid({ metrics }: { metrics: PublicMetric[] }) {
  return (
    <div className="mon-public-metrics">
      {metrics.map((metric) => (
        <article key={metric.label} className={`mon-public-metric is-${metric.tone ?? "base"}`}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <em>{metric.hint}</em>
        </article>
      ))}
    </div>
  );
}

function AccreditationReport({ payload }: { payload: MonitoreoPublicReportPayload }) {
  const report = payload.accreditation!;
  const actors = report.actors ?? [];
  const daily = report.daily_general ?? [];
  const sources = report.sources ?? [];
  const metrics = useMemo<PublicMetric[]>(() => {
    const universe = actors.reduce((sum, row) => sum + (rowNumber(row, ["Universo"]) ?? 0), 0);
    const effective = actors.reduce((sum, row) => sum + (rowNumber(row, ["Efectivas"]) ?? 0), 0);
    const pending = Math.max(0, universe - effective);
    return [
      { label: "Efectivas", value: formatMetric(effective || metricNumber(report.summary, "Efectivas")), hint: `${formatPercent(safePercent(effective, universe))} del universo`, tone: "ready" },
      { label: "Universo", value: formatMetric(universe || metricNumber(report.summary, "Universo")), hint: `${actors.length.toLocaleString("es-PE")} actores`, tone: "base" },
      { label: "Pendientes", value: formatMetric(pending), hint: "contra universo", tone: pending ? "warning" : "ready" },
    ];
  }, [actors, report.summary]);

  return (
    <>
      <MetricGrid metrics={metrics} />
      <section className="mon-public-layout">
        <DailyChart
          title="Avance diario"
          rows={daily}
          totalKeys={["Total respuestas", "Efectivas"]}
          doneKeys={["Efectivas"]}
          pendingKeys={[]}
          warningKeys={[]}
          dateKeys={["Fecha"]}
        />
        <ActorProgress actors={actors} />
      </section>
      <SourcesTable rows={sources} />
    </>
  );
}

function TerritorialReport({ payload }: { payload: MonitoreoPublicReportPayload }) {
  const report = payload.territorial!;
  const advance = report.advance ?? {};
  const districts = report.district_progress ?? [];
  const daily = report.daily ?? [];
  const metrics = useMemo<PublicMetric[]>(() => {
    const valid = rowNumber(advance, ["validas"]) ?? rowNumber(report.kpis, ["validas"]) ?? 0;
    const meta = rowNumber(advance, ["meta"]) ?? rowNumber(report.kpis, ["meta"]);
    const gap = rowNumber(advance, ["brecha"]);
    const activeDistricts = districts.filter((row) => (rowNumber(row, ["validas"]) ?? 0) > 0).length;
    return [
      { label: "Validas", value: formatMetric(valid), hint: `${formatPercent(rowNumber(advance, ["avance_pct"]) ?? safePercent(valid, meta))} de avance`, tone: "ready" },
      { label: "Meta", value: formatMetric(meta), hint: "objetivo territorial", tone: "base" },
      { label: "Brecha", value: formatMetric(gap), hint: "pendientes contra meta", tone: gap ? "warning" : "ready" },
      { label: "Distritos con avance", value: formatMetric(activeDistricts), hint: `${formatMetric(districts.length)} distritos publicados`, tone: "base" },
    ];
  }, [advance, districts, report.kpis]);

  return (
    <>
      <MetricGrid metrics={metrics} />
      <section className="mon-public-layout">
        <DailyChart
          title="Avance diario"
          rows={daily}
          totalKeys={["total"]}
          doneKeys={["validas"]}
          pendingKeys={[]}
          warningKeys={[]}
          dateKeys={["date_label", "date"]}
        />
        <DistrictProgress rows={districts} activePhase={report.active_route_phase} />
      </section>
    </>
  );
}

function internalRows(value: unknown): MonitoreoRow[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item): item is MonitoreoRow => item != null && typeof item === "object");
  if (typeof value === "object" && Array.isArray((value as { rows?: unknown[] }).rows)) {
    return (value as { rows: unknown[] }).rows.filter((item): item is MonitoreoRow => item != null && typeof item === "object");
  }
  return [];
}

function internalPath(root: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => (
    current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined
  ), root);
}

function InternalReport({ payload }: { payload: MonitoreoPublicReportPayload }) {
  const internal = payload.internal!;
  const reports = internal.reports ?? {};
  const accreditation = payload.accreditation as Record<string, unknown> | undefined;
  const territorial = payload.territorial as Record<string, unknown> | undefined;
  const queries = (accreditation?.internal_queries ?? internalPath(reports, ["internal_queries"]) ?? internalPath(territorial, ["internal_queries"]) ?? {}) as Record<string, unknown>;
  const snapshotRows = internal.snapshot?.rows ?? internalRows(accreditation?.snapshot_rows ?? territorial?.snapshot_rows);
  const cases = internalRows(
    queries.cases ?? queries.review_cases ?? queries.far_gps ?? queries.duration_review ?? queries.incomplete_blocks,
  );
  const issues = internalRows(queries.issues ?? queries.lagging_districts);
  const metrics = [
    { label: "Registros", value: formatMetric(internal.n_rows ?? payload.n_rows), hint: "snapshot operativo", tone: "base" as const },
    { label: "Casos accionables", value: formatMetric(cases.length), hint: "filas de revisión", tone: cases.length ? "warning" as const : "ready" as const },
    { label: "Alertas", value: formatMetric(issues.length), hint: "prioridades internas", tone: issues.length ? "warning" as const : "ready" as const },
    { label: "Audiencia", value: "Interna", hint: "Space privado", tone: "danger" as const },
  ];
  return (
    <>
      <MetricGrid metrics={metrics} />
      <section className="mon-public-private-note">
        <ShieldAlert size={16} />
        <div>
          <strong>Vista interna privada</strong>
          <p>Este Space contiene datos completos del corte. No hay descargas desde esta interfaz.</p>
        </div>
      </section>
      <section className="mon-public-layout">
        <InternalDataTable title="Casos accionables" rows={cases} icon={<ShieldAlert size={14} />} />
        <InternalDataTable title="Alertas y auditoría" rows={issues} icon={<CheckCircle2 size={14} />} />
      </section>
      <InternalDataTable title="Snapshot operativo completo" rows={snapshotRows} icon={<Layers3 size={14} />} wide />
    </>
  );
}

function InternalDataTable({ title, rows, icon, wide = false }: { title: string; rows: MonitoreoRow[]; icon: ReactNode; wide?: boolean }) {
  const columns = useMemo(() => {
    const seen: string[] = [];
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!seen.includes(key)) seen.push(key);
      });
    });
    return seen.slice(0, 16);
  }, [rows]);
  if (!rows.length) {
    return (
      <article className={`mon-public-panel${wide ? " mon-public-panel--wide" : ""}`}>
        <header className="mon-public-panel-head">
          <div><span>{icon} Interno</span><strong>{title}</strong></div>
          <em>0 filas</em>
        </header>
        <EmptyState icon={<CheckCircle2 size={18} />} title="Sin filas en este bloque" variant="inline" />
      </article>
    );
  }
  return (
    <article className={`mon-public-panel${wide ? " mon-public-panel--wide" : ""}`}>
      <header className="mon-public-panel-head">
        <div><span>{icon} Interno</span><strong>{title}</strong></div>
        <em>{rows.length.toLocaleString("es-PE")} filas</em>
      </header>
      <div className="mon-public-table-wrap is-internal">
        <table className="mon-public-table">
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => <td key={column}>{rowText(row, [column], "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function DailyChart({
  title,
  rows,
  totalKeys,
  doneKeys,
  pendingKeys,
  warningKeys,
  dateKeys,
}: {
  title: string;
  rows: MonitoreoRow[];
  totalKeys: string[];
  doneKeys: string[];
  pendingKeys: string[];
  warningKeys: string[];
  dateKeys: string[];
}) {
  const points = rows.map((row) => {
    const done = rowNumber(row, doneKeys) ?? 0;
    const pending = rowNumber(row, pendingKeys) ?? 0;
    const warning = rowNumber(row, warningKeys) ?? 0;
    const total = rowNumber(row, totalKeys) ?? done + pending + warning;
    return { label: rowText(row, dateKeys, "Sin fecha"), done, pending, warning, total };
  });
  const max = Math.max(1, ...points.map((point) => point.total));
  return (
    <article className="mon-public-panel">
      <header className="mon-public-panel-head">
        <div>
          <span><CalendarRange size={14} /> Diario</span>
          <strong>{title}</strong>
        </div>
        <em>{points.length.toLocaleString("es-PE")} dias</em>
      </header>
      {points.length ? (
        <div className="mon-public-daily">
          {points.map((point) => (
            <div key={point.label} className="mon-public-daily-row">
              <span>{point.label}</span>
              <div className="mon-public-daily-bar" aria-label={`${point.label}: ${point.total} respuestas`}>
                <i className="is-done" style={{ width: `${Math.max(0, (point.done / max) * 100)}%` }} />
                <i className="is-pending" style={{ width: `${Math.max(0, (point.pending / max) * 100)}%` }} />
                <i className="is-warning" style={{ width: `${Math.max(0, (point.warning / max) * 100)}%` }} />
              </div>
              <strong>{formatMetric(point.total)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Clock size={18} />} title="Sin serie diaria" hint="El corte publicado no contiene fechas agregadas." variant="inline" />
      )}
    </article>
  );
}

function ActorProgress({ actors }: { actors: MonitoreoRow[] }) {
  return (
    <article className="mon-public-panel">
      <header className="mon-public-panel-head">
        <div>
          <span><Target size={14} /> Actores</span>
          <strong>Avance por actor</strong>
        </div>
        <em>{actors.length.toLocaleString("es-PE")} filas</em>
      </header>
      <div className="mon-public-progress-list">
        {actors.map((row) => {
          const actor = rowText(row, ["Actor"], "Sin actor");
          const effective = rowNumber(row, ["Efectivas"]) ?? 0;
          const universe = rowNumber(row, ["Universo"]) ?? 0;
          const progress = rowNumber(row, ["Avance universo"]) ?? safePercent(effective, universe) ?? 0;
          const pending = Math.max(0, universe - effective);
          return (
            <section key={actor} className="mon-public-progress-card">
              <header>
                <strong>{actor}</strong>
                <span>{formatPercent(progress)}</span>
              </header>
              <div className="mon-public-meter"><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
              <dl>
                <div><dt>Efectivas</dt><dd>{formatMetric(effective)}</dd></div>
                <div><dt>Universo</dt><dd>{formatMetric(universe)}</dd></div>
                <div><dt>Pendientes</dt><dd>{formatMetric(pending)}</dd></div>
              </dl>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function DistrictProgress({ rows, activePhase }: { rows: MonitoreoRow[]; activePhase: string }) {
  return (
    <article className="mon-public-panel">
      <header className="mon-public-panel-head">
        <div>
          <span><Layers3 size={14} /> {activePhase === "field" ? "Campo" : "Piloto"}</span>
          <strong>Avance por distrito</strong>
        </div>
        <em>{rows.length.toLocaleString("es-PE")} distritos</em>
      </header>
      <div className="mon-public-progress-list">
        {rows.map((row) => {
          const district = rowText(row, ["distrito"], "Sin distrito");
          const valid = rowNumber(row, ["validas"]) ?? 0;
          const meta = rowNumber(row, ["meta"]);
          const progress = rowNumber(row, ["avance_pct"]) ?? safePercent(valid, meta) ?? 0;
          const gap = rowNumber(row, ["brecha"]);
          return (
            <section key={`${rowText(row, ["ubigeo"], district)}-${district}`} className="mon-public-progress-card">
              <header>
                <strong>{district}</strong>
                <span>{formatPercent(progress)}</span>
              </header>
              <div className="mon-public-meter"><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
              <dl>
                <div><dt>Validas</dt><dd>{formatMetric(valid)}</dd></div>
                <div><dt>Meta</dt><dd>{formatMetric(meta)}</dd></div>
                <div><dt>Brecha</dt><dd>{formatMetric(gap)}</dd></div>
              </dl>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function SourcesTable({ rows }: { rows: MonitoreoRow[] }) {
  if (!rows.length) return null;
  return (
    <article className="mon-public-panel mon-public-panel--wide">
      <header className="mon-public-panel-head">
        <div>
          <span><CheckCircle2 size={14} /> Fuentes</span>
          <strong>Fuentes agregadas por actor</strong>
        </div>
        <em>{rows.length.toLocaleString("es-PE")} fuentes</em>
      </header>
      <div className="mon-public-table-wrap">
        <table className="mon-public-table">
          <thead>
            <tr>
              <th>Actor</th>
              <th>Canal</th>
              <th>Fuente</th>
              <th>Efectivas</th>
              <th>Ultima efectiva</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${rowText(row, ["Actor"])}-${rowText(row, ["Fuente"])}-${index}`}>
                <td>{rowText(row, ["Actor"], "Sin actor")}</td>
                <td>{rowText(row, ["Canal"], "Sin canal")}</td>
                <td>{rowText(row, ["Fuente"], "Encuesta")}</td>
                <td>{formatMetric(rowNumber(row, ["Efectivas"]))}</td>
                <td>{rowText(row, ["Ultima efectiva", "Última efectiva"], "S/D")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
