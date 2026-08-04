import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BarChart3, CheckCircle2, CircleSlash2, EyeOff, Loader2, RefreshCw, Target } from "lucide-react";
import type { GraficosCoverageSummary, GraficosCoverageVariable } from "../../api/client";
import { usePlanStore } from "./store";
import { usePlanCoverage, variableCoverageRef } from "./usePlanCoverage";
import { basesSinCubrir, coberturaPorBase } from "./coberturaPorBase";

const STATUS_LABELS: Record<string, string> = {
  cubierta: "Incluidas",
  sin_usar: "Sin usar",
  cubierta_por_recodificada: "Cubiertas por recodificada",
  integrada_en_otra_variable: "Integradas en otra variable",
  no_graficable: "No graficables",
  vacía: "Vacías",
  excluida_intencionalmente: "Marcadas como no graficar",
};

const STATUS_HINTS: Record<string, string> = {
  sin_usar: "Variables útiles que todavía no aparecen en el plan.",
  cubierta_por_recodificada: "La variable original queda cubierta porque se prioriza su versión recodificada.",
  integrada_en_otra_variable: "Campos tipo Otros/Other que pertenecen a una variable madre.",
  no_graficable: "Abiertas crudas, identificadores, contactos o tipos que no conviene graficar.",
  vacía: "Variables disponibles en el instrumento pero sin datos efectivos.",
  excluida_intencionalmente: "Variables graficables que el usuario decidió dejar fuera del plan.",
};

export function PlanCoverageBadge() {
  const { coverage, loading, error } = usePlanCoverage();
  const setCoverageExcluded = usePlanStore((s) => s.setCoverageExcluded);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // El popover mide 680px y se anclaba con `right: 0` al badge, que en el
  // toolbar vive a media pantalla: en 1280 —viewport de la matriz de QA— se
  // salía ~70px por la izquierda y el contenido quedaba cortado. Se ancla al
  // viewport, como el picker de variables.
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margen = 14;
      const ancho = Math.min(680, window.innerWidth - margen * 2);
      const derecha = rect.right - ancho;
      const left = Math.max(margen, Math.min(derecha, window.innerWidth - ancho - margen));
      setPopoverStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left,
        width: ancho,
        right: "auto",
        // Sin piso artificial: en 1024x600 el toolbar envuelve y el badge baja
        // hasta ~310px, así que un mínimo de 280px empujaba el popover fuera
        // de la pantalla. Lo que no entra se recorre por dentro.
        maxHeight: Math.max(160, window.innerHeight - rect.bottom - 20),
      });
    }
    place();
    // Tras un resize el toolbar se reacomoda: medir en el mismo frame devuelve
    // la geometría anterior y el popover queda con el alto del viewport viejo.
    const replace = () => requestAnimationFrame(() => requestAnimationFrame(place));
    window.addEventListener("resize", replace);
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      // El popover ya no cuelga del root (va por portal), así que hay que
      // excluirlo a mano o cada click dentro lo cerraría.
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", replace);
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const summary = coverage?.summary;
  const progress = summary ? coverageProgress(summary) : 0;
  const coveragePhrase = summary ? coverageHeadline(summary) : "Inventario de variables";
  const label = error
    ? "Cobertura no disponible"
    : summary
      ? `${summary.included_graphable}/${summary.graphable_variables}`
      : "Cobertura";

  const tone = error
    ? "danger"
    : summary && summary.unused_graphable === 0
      ? "success"
      : "info";

  const desglose = useMemo(() => coberturaPorBase(coverage?.sources), [coverage]);
  const sinCubrir = useMemo(() => basesSinCubrir(desglose), [desglose]);

  const groups = useMemo(() => {
    const map: Record<string, Array<{ source: string; variable: GraficosCoverageVariable }>> = {};
    for (const source of coverage?.sources ?? []) {
      for (const variable of source.variables ?? []) {
        const status = variable.status || "sin_estado";
        (map[status] ??= []).push({ source: source.name, variable });
      }
    }
    return map;
  }, [coverage]);

  return (
    <div ref={rootRef} className="pulso-gv2-coverage-root">
      <button
        type="button"
        className={`pulso-gv2-coverage-trigger is-${tone}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Cobertura de variables del plan de gráficos"
      >
        {loading ? <Loader2 size={12} className="pulso-spin" /> : <BarChart3 size={12} />}
        {label}
      </button>

      {/* El popover va por portal: el toolbar tiene backdrop-filter y un
          `position: fixed` dentro de él se ancla al toolbar, no al viewport
          —medía bien y se dibujaba 140px más abajo, fuera de pantalla—. */}
      {open && typeof document !== "undefined" && createPortal((
        <div ref={popoverRef} className="pulso-gv2-coverage-popover" role="dialog" aria-label="Cobertura del plan de gráficos" style={popoverStyle}>
          <div className="pulso-gv2-coverage-head">
            <span className={`pulso-gv2-coverage-head-mark is-${tone}`} aria-hidden="true">
              {loading ? <Loader2 size={15} className="pulso-spin" /> : <Target size={15} />}
            </span>
            <div className="pulso-gv2-coverage-head-copy">
              <strong>{coveragePhrase}</strong>
              <span>
                {summary
                  ? `${summary.total_variables} variables totales · ${summary.graphable_variables} graficables detectadas`
                  : "Calculando inventario del instrumento"}
              </span>
            </div>
            {summary && (
              <span className={`pulso-gv2-coverage-head-pill is-${tone}`}>
                {progress}%
              </span>
            )}
          </div>

          {error && (
            <div className="pulso-gv2-coverage-error">
              {error}
            </div>
          )}

          {coverage?.warnings?.length ? (
            <div className="pulso-gv2-coverage-warning">
              {coverage.warnings.join(" · ")}
            </div>
          ) : null}

          {summary && (
            <>
              <div className="pulso-gv2-coverage-progress-card">
                <div className="pulso-gv2-coverage-progress-copy">
                  <strong>{summary.included_graphable}/{summary.graphable_variables}</strong>
                  <span>{summary.unused_graphable === 0 ? "Todo lo graficable está cubierto o excluido." : `${summary.unused_graphable} variable${summary.unused_graphable === 1 ? "" : "s"} graficable${summary.unused_graphable === 1 ? "" : "s"} pendiente${summary.unused_graphable === 1 ? "" : "s"}.`}</span>
                </div>
                <div
                  className={`pulso-gv2-coverage-progress is-${tone}`}
                  role="meter"
                  aria-label="Porcentaje de variables graficables cubiertas"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="pulso-gv2-coverage-kpis">
                <CoverageKpi tone="success" label="Incluidas" value={summary.included_graphable} total={summary.graphable_variables} />
                <CoverageKpi tone={summary.unused_graphable > 0 ? "info" : "success"} label="Sin usar" value={summary.unused_graphable} />
                <CoverageKpi tone="mode" label="Recodificadas" value={summary.covered_by_recod} />
                <CoverageKpi tone="muted" label="No graficables" value={summary.not_graphable + summary.empty} />
              </div>

              {desglose.length > 1 && (
                <div className="pulso-gv2-coverage-bases">
                  <div className="pulso-gv2-coverage-bases-head">
                    <span>Por base</span>
                    {sinCubrir.length > 0 && (
                      <span className="pulso-gv2-coverage-bases-alert">
                        {sinCubrir.length === 1
                          ? `${sinCubrir[0]} no tiene ningún gráfico`
                          : `${sinCubrir.length} bases sin ningún gráfico`}
                      </span>
                    )}
                  </div>
                  {desglose.map((fila) => (
                    <div
                      key={fila.base}
                      className={`pulso-gv2-coverage-base-row ${fila.incluidas === 0 ? "is-vacia" : ""}`}
                    >
                      <span className="pulso-gv2-coverage-base-name">{fila.base}</span>
                      <span className="pulso-gv2-coverage-base-bar" aria-hidden="true">
                        <span
                          style={{
                            width: `${fila.graficables > 0 ? Math.round((fila.incluidas / fila.graficables) * 100) : 0}%`,
                          }}
                        />
                      </span>
                      <span className="pulso-gv2-coverage-base-count">
                        {fila.incluidas}/{fila.graficables}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <CoverageGroup
            status="sin_usar"
            items={groups.sin_usar ?? []}
            onExclude={(ref) => setCoverageExcluded(ref, true)}
          />
          <CoverageGroup
            status="excluida_intencionalmente"
            items={groups.excluida_intencionalmente ?? []}
            onInclude={(ref) => setCoverageExcluded(ref, false)}
          />
          <CoverageGroup status="cubierta_por_recodificada" items={groups.cubierta_por_recodificada ?? []} />
          <CoverageGroup status="integrada_en_otra_variable" items={groups.integrada_en_otra_variable ?? []} />
          <CoverageGroup status="no_graficable" items={groups.no_graficable ?? []} compact />
          <CoverageGroup status="vacía" items={groups.vacía ?? []} compact />
        </div>
      ), document.body)}
    </div>
  );
}

function coverageProgress(summary: GraficosCoverageSummary): number {
  if (!summary.graphable_variables) return 100;
  return Math.round((summary.included_graphable / summary.graphable_variables) * 100);
}

function coverageHeadline(summary: GraficosCoverageSummary): string {
  if (summary.graphable_variables === 0) return "Sin variables graficables";
  if (summary.unused_graphable === 0) return "Cobertura lista";
  return "Cobertura por completar";
}

function CoverageKpi({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total?: number;
  tone: "success" | "info" | "mode" | "muted";
}) {
  return (
    <div className="pulso-gv2-coverage-kpi" data-tone={tone}>
      <strong>{value}{typeof total === "number" ? `/${total}` : ""}</strong>
      <span>{label}</span>
    </div>
  );
}

function CoverageGroup({
  status,
  items,
  onExclude,
  onInclude,
  compact = false,
}: {
  status: string;
  items: Array<{ source: string; variable: GraficosCoverageVariable }>;
  onExclude?: (ref: string) => void;
  onInclude?: (ref: string) => void;
  compact?: boolean;
}) {
  if (!items.length) return null;
  const visible = compact ? items.slice(0, 8) : items.slice(0, 20);
  const Icon = status === "excluida_intencionalmente" ? EyeOff :
    status === "no_graficable" || status === "vacía" ? CircleSlash2 :
      CheckCircle2;

  return (
    <section className="pulso-gv2-coverage-group" data-status={status} data-compact={compact ? "true" : "false"}>
      <div className="pulso-gv2-coverage-group-title">
        <span><Icon size={12} /> {STATUS_LABELS[status] ?? status}</span>
        <small>{items.length}</small>
      </div>
      {STATUS_HINTS[status] && <p>{STATUS_HINTS[status]}</p>}
      <div className="pulso-gv2-coverage-list">
        {visible.map(({ source, variable }) => {
          const ref = variableCoverageRef(source, variable);
          return (
            <div key={`${source}:${variable.name}`} className="pulso-gv2-coverage-row">
              <div>
                <span className="pulso-gv2-coverage-row-meta">
                  {source && source !== "default" && <small>{source}</small>}
                  <code>{variable.name}</code>
                </span>
                <span>{variable.label || variable.name}</span>
                {variable.exclusion_reason && <em>{variable.exclusion_reason}</em>}
              </div>
              {onExclude && (
                <button type="button" onClick={() => onExclude(ref)}>
                  <EyeOff size={11} /> No graficar
                </button>
              )}
              {onInclude && (
                <button type="button" onClick={() => onInclude(ref)}>
                  <RefreshCw size={11} /> Reconsiderar
                </button>
              )}
            </div>
          );
        })}
        {items.length > visible.length && (
          <div className="pulso-gv2-coverage-more">
            +{items.length - visible.length} variables más
          </div>
        )}
      </div>
    </section>
  );
}
