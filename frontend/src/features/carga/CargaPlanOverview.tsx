import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Network,
  ShieldCheck,
} from "../../vendor/lucide-react";
import type { EstudioBase } from "../../api/client";
import type { CargaTopologyResolution } from "./CargaTopologyModel";

type CoverageState = "ready" | "attention" | "pending";

type CoverageRow = {
  key: string;
  label: string;
  meta: string;
  hasInstrument: boolean;
  hasData: boolean;
  state: CoverageState;
};

function baseLabel(base: EstudioBase) {
  return String(base.source_alias || base.source_title || base.nombre || "").trim() || base.nombre;
}

function sourceLabel(base: EstudioBase) {
  if (base.source_kind === "surveymonkey") return "SurveyMonkey";
  if (base.source_kind === "kobo_repeat") return "Kobo · grupo repetido";
  if (base.source_kind?.startsWith("kobo")) return "KoboToolbox";
  return "Archivo o fuente local";
}

function baseMeta(base: EstudioBase) {
  const rows = typeof base.n_filas === "number"
    ? `${base.n_filas.toLocaleString("es-PE")} filas`
    : "filas por contar";
  const columns = typeof base.n_columnas === "number"
    ? `${base.n_columnas.toLocaleString("es-PE")} columnas`
    : "columnas por contar";
  return `${sourceLabel(base)} · ${rows} · ${columns}`;
}

function rowState(hasInstrument: boolean, hasData: boolean): CoverageState {
  if (hasInstrument && hasData) return "ready";
  if (hasInstrument || hasData) return "attention";
  return "pending";
}

function statusLabel(row: CoverageRow) {
  if (row.state === "ready") return "Completa";
  if (row.state === "attention") return "Incompleta";
  return "Pendiente";
}

function topologyTitle(resolution: CargaTopologyResolution) {
  if (resolution.status === "conflict") return "Conflicto de topología";
  if (resolution.mode === "undecided") return "Topología por definir";
  if (resolution.mode === "single") return "Una base";
  if (resolution.status === "planned" && !resolution.strategy) {
    return "Varias bases en preparación · organización por definir";
  }
  const label = resolution.strategy === "integrated"
    ? "Base integrada"
    : resolution.strategy === "independent"
      ? "Hermanas independientes"
      : "Bases separadas";
  return resolution.status === "planned" ? `${label} en preparación` : label;
}

function topologyDetail(resolution: CargaTopologyResolution) {
  if (resolution.status === "conflict") {
    return "Hay marcadores incompatibles. Conservamos el estado actual hasta revisar la organización en Fuentes.";
  }
  if (resolution.mode === "undecided") {
    return "Elige deliberadamente si el estudio trabajará con una base o con varias bases.";
  }
  if (resolution.status === "planned") {
    return "La organización aún es un plan. Fuentes la materializa; aquí no se importan ni transforman datos.";
  }
  return "La organización mostrada ya se reconoce en el estudio; Plan la refleja sin transformar archivos.";
}

export function CargaPlanOverview({
  topology,
  bases,
  hasInstrument,
  hasData,
  pendingChoiceMapping,
  allReady,
  children,
  onOpenSources,
}: {
  topology: CargaTopologyResolution;
  bases: EstudioBase[];
  hasInstrument: boolean;
  hasData: boolean;
  pendingChoiceMapping: boolean;
  allReady: boolean;
  children?: ReactNode;
  onOpenSources?: () => void;
}) {
  const topologyDefined = topology.mode !== "undecided";
  const rows: CoverageRow[] = topology.mode === "multi"
    ? bases.map((base) => {
        const baseHasInstrument = Boolean(base.xlsform_file_id);
        const baseHasData = Boolean(base.data_file_id);
        return {
          key: base.nombre,
          label: baseLabel(base),
          meta: baseMeta(base),
          hasInstrument: baseHasInstrument,
          hasData: baseHasData,
          state: rowState(baseHasInstrument, baseHasData),
        };
      })
    : topologyDefined ? [{
        key: "single",
        label: "Base del estudio",
        meta: hasData ? "Respuestas conectadas a esta sesión" : "Aún sin respuestas conectadas",
        hasInstrument,
        hasData,
        state: rowState(hasInstrument, hasData),
      }] : [];
  const plannedBaseCount = topology.mode === "multi" ? bases.length : topologyDefined ? 1 : 0;
  const instrumentCount = topology.mode === "multi"
    ? rows.filter((row) => row.hasInstrument).length
    : Number(hasInstrument);
  const dataCount = topology.mode === "multi"
    ? rows.filter((row) => row.hasData).length
    : Number(hasData);

  return (
    <section
      className="pulso-carga-plan-overview"
      data-carga-surface="plan"
      aria-labelledby="carga-plan-title"
    >
      <div className="pulso-carga-plan-topology" data-carga-plan-region="topology">
        <div className="pulso-carga-plan-heading">
          <span className="pulso-carga-plan-heading-icon" aria-hidden="true">
            <Network size={18} />
          </span>
          <div>
            <h2 id="carga-plan-title">{topologyTitle(topology)}</h2>
            <p>{topologyDetail(topology)}</p>
          </div>
        </div>
        {children && <div className="pulso-carga-plan-control">{children}</div>}
      </div>

      <section
        className="pulso-carga-plan-coverage"
        data-carga-plan-region="coverage"
        aria-labelledby="carga-plan-coverage-title"
      >
        <header className="pulso-carga-plan-coverage-head">
          <h3 id="carga-plan-coverage-title">Qué tiene cada base</h3>
          <dl className="pulso-carga-plan-metrics" aria-label="Resumen de cobertura">
            <div>
              <dt>Bases</dt>
              <dd>{plannedBaseCount}</dd>
            </div>
            <div>
              <dt>Formularios</dt>
              <dd>{plannedBaseCount > 0 ? `${instrumentCount}/${plannedBaseCount}` : "—"}</dd>
            </div>
            <div>
              <dt>Respuestas</dt>
              <dd>{plannedBaseCount > 0 ? `${dataCount}/${plannedBaseCount}` : "—"}</dd>
            </div>
            <div className={pendingChoiceMapping ? "is-attention" : allReady ? "is-ready" : ""}>
              <dt>Revisión</dt>
              <dd>{!topologyDefined ? "Por definir" : pendingChoiceMapping ? "Pendiente" : allReady ? "Lista" : "En espera"}</dd>
            </div>
          </dl>
        </header>

        <div
          className="pulso-carga-plan-roster"
          data-empty={rows.length === 0 ? "true" : undefined}
          role="region"
          aria-label="Cobertura por base"
        >
          <ul aria-label="Bases del estudio">
            {rows.length > 0 ? rows.map((row) => (
              <li
                key={row.key}
                className={`is-${row.state}`}
                data-qa-geometry-group="carga-base-assets"
                data-qa-geometry-contract="equal"
              >
                <span className="pulso-carga-plan-row-state" aria-hidden="true">
                  {row.state === "ready"
                    ? <CheckCircle2 size={16} />
                    : row.state === "attention"
                      ? <AlertTriangle size={16} />
                      : <Database size={16} />}
                </span>
                <span className="pulso-carga-plan-row-copy">
                  <strong>{row.label}</strong>
                  <small>{row.meta}</small>
                </span>
                <span
                  className={`pulso-carga-plan-asset${row.hasInstrument ? " is-ready" : ""}`}
                  data-qa-geometry-member
                >
                  <FileSpreadsheet size={14} aria-hidden="true" />
                  {row.hasInstrument ? "Formulario" : "Sin formulario"}
                </span>
                <span
                  className={`pulso-carga-plan-asset${row.hasData ? " is-ready" : ""}`}
                  data-qa-geometry-member
                >
                  <Database size={14} aria-hidden="true" />
                  {row.hasData ? "Respuestas" : "Sin respuestas"}
                </span>
                <span className="pulso-carga-plan-row-label">
                  <ShieldCheck size={13} aria-hidden="true" />
                  {statusLabel(row)}
                </span>
              </li>
            )) : (
              <li className="is-empty">
                <span className="pulso-carga-plan-row-state" aria-hidden="true">
                  <Database size={16} />
                </span>
                <span className="pulso-carga-plan-row-copy">
                  <strong>{topologyDefined ? "Aún no hay bases creadas" : "Aún no hay una base definida"}</strong>
                  <small>
                    {topology.mode === "multi"
                      ? "Ve a Fuentes para crear la primera base y asignarle formulario y respuestas."
                      : topologyDefined
                        ? "Ve a Fuentes para añadir el formulario y las respuestas de la base."
                        : "Define arriba la topología; después añade el formulario y las respuestas desde Fuentes."}
                  </small>
                </span>
                {topologyDefined && onOpenSources ? (
                  <button
                    type="button"
                    className="pulso-carga-plan-empty-action"
                    onClick={onOpenSources}
                  >
                    Añadir fuentes
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            )}
          </ul>
        </div>
      </section>
    </section>
  );
}
