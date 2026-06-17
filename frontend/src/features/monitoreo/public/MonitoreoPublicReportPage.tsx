import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarRange, CheckCircle2, Clock, Layers3, ShieldAlert, Target } from "lucide-react";
import { Alert } from "../../../components/Alert";
import { EmptyState, LoadingBlock } from "../../../components/States";
import {
  apiMonitoreoPublicReport,
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

      {payload.accreditation ? (
        <AccreditationReport payload={payload} />
      ) : payload.territorial ? (
        <TerritorialReport payload={payload} />
      ) : (
        <EmptyState icon={<BarChart3 size={18} />} title="Perfil no disponible" hint="Este reporte publico no tiene un perfil de Monitoreo compatible." />
      )}
    </section>
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
    const partial = actors.reduce((sum, row) => sum + (rowNumber(row, ["Parciales"]) ?? 0), 0);
    const refusal = actors.reduce((sum, row) => sum + (rowNumber(row, ["Rechazos plataforma"]) ?? 0), 0);
    const gap = actors.reduce((sum, row) => sum + Math.max(0, rowNumber(row, ["Brecha meta"]) ?? 0), 0);
    return [
      { label: "Efectivas", value: formatMetric(effective || metricNumber(report.summary, "Efectivas")), hint: `${formatPercent(safePercent(effective, universe))} del universo`, tone: "ready" },
      { label: "Universo", value: formatMetric(universe || metricNumber(report.summary, "Universo")), hint: `${actors.length.toLocaleString("es-PE")} actores`, tone: "base" },
      { label: "Brecha meta", value: formatMetric(gap), hint: report.has_targets ? "pendiente contra meta" : "meta no configurada", tone: gap ? "warning" : "ready" },
      { label: "Parciales", value: formatMetric(partial), hint: `${formatMetric(refusal)} rechazos plataforma`, tone: partial || refusal ? "warning" : "base" },
    ];
  }, [actors, report.has_targets, report.summary]);

  return (
    <>
      <MetricGrid metrics={metrics} />
      <section className="mon-public-layout">
        <DailyChart
          title="Avance diario"
          rows={daily}
          totalKeys={["Total respuestas", "Efectivas"]}
          doneKeys={["Efectivas"]}
          pendingKeys={["Parciales"]}
          warningKeys={["Rechazos plataforma"]}
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
    const revision = rowNumber(report.kpis, ["revision"]) ?? 0;
    const activeDistricts = districts.filter((row) => (rowNumber(row, ["validas"]) ?? 0) > 0).length;
    return [
      { label: "Validas", value: formatMetric(valid), hint: `${formatPercent(rowNumber(advance, ["avance_pct"]) ?? safePercent(valid, meta))} de avance`, tone: "ready" },
      { label: "Meta", value: formatMetric(meta), hint: "objetivo territorial", tone: "base" },
      { label: "Brecha", value: formatMetric(gap), hint: "pendientes contra meta", tone: gap ? "warning" : "ready" },
      { label: "Distritos con avance", value: formatMetric(activeDistricts), hint: `${formatMetric(districts.length)} distritos publicados`, tone: "base" },
      { label: "Revision", value: formatMetric(revision), hint: "respuestas en observacion", tone: revision ? "warning" : "ready" },
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
          pendingKeys={["revision"]}
          warningKeys={["no_defendibles"]}
          dateKeys={["date_label", "date"]}
        />
        <DistrictProgress rows={districts} activePhase={report.active_route_phase} />
      </section>
    </>
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
          const meta = rowNumber(row, ["Meta"]);
          const progress = rowNumber(row, ["Avance meta"]) ?? rowNumber(row, ["Avance universo"]) ?? safePercent(effective, meta ?? universe) ?? 0;
          const gap = rowNumber(row, ["Brecha meta"]);
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
                <div><dt>Revision</dt><dd>{formatMetric(rowNumber(row, ["revision"]))}</dd></div>
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
              <th>Parciales</th>
              <th>Rechazos</th>
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
                <td>{formatMetric(rowNumber(row, ["Parciales"]))}</td>
                <td>{formatMetric(rowNumber(row, ["Rechazos plataforma"]))}</td>
                <td>{rowText(row, ["Ultima efectiva", "Última efectiva"], "S/D")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
