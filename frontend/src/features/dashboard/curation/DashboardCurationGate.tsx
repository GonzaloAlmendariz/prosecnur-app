import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Columns3, Database, LayoutDashboard } from "lucide-react";
import {
  apiDashboardCurationGet,
  apiDashboardCurationPut,
  type DashboardCurationPayload,
} from "../../../api/client";
import { EmptyState } from "../shared/EmptyState";

export function DashboardCurationGate({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardCurationPayload | null>(null);
  const [includeSections, setIncludeSections] = useState<Set<string>>(new Set());
  const [includeVars, setIncludeVars] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiDashboardCurationGet()
      .then((r) => {
        if (cancelled) return;
        setPayload(r.payload);
        const excludedSections = new Set(r.payload.exclude_sections);
        const excludedVars = new Set(r.payload.exclude_vars);
        setIncludeSections(
          new Set(
            r.payload.secciones
              .filter((s) => !excludedSections.has(s.nombre))
              .filter((s) =>
                s.vars.some(
                  (v) =>
                    v.default_include &&
                    (r.payload.confirmed ? !excludedVars.has(v.name) : true),
                ),
              )
              .map((s) => s.nombre),
          ),
        );
        setIncludeVars(
          new Set(
            r.payload.secciones.flatMap((s) =>
              s.vars
                .filter((v) =>
                  v.default_include &&
                  (r.payload.confirmed ? !excludedVars.has(v.name) : true),
                )
                .map((v) => v.name),
            ),
          ),
        );
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const defaultIncludedCount = useMemo(() => {
    if (!payload) return 0;
    return payload.secciones.reduce(
      (acc, s) => acc + s.vars.filter((v) => v.default_include).length,
      0,
    );
  }, [payload]);
  const curationStats = useMemo(() => {
    if (!payload) {
      return {
        eligibleSections: 0,
        includedSections: 0,
        selectedVars: 0,
        totalVars: 0,
        nonDashboardVars: 0,
        percentReady: 0,
      };
    }
    const eligibleSections = payload.secciones.filter((s) =>
      s.vars.some((v) => v.default_include),
    ).length;
    const includedSections = payload.secciones.filter((s) =>
      s.vars.some((v) => v.default_include && includeVars.has(v.name)),
    ).length;
    const selectedVars = payload.secciones.reduce(
      (acc, s) =>
        acc +
        s.vars.filter((v) => v.default_include && includeVars.has(v.name)).length,
      0,
    );
    const totalVars = payload.secciones.reduce((acc, s) => acc + s.vars.length, 0);
    const nonDashboardVars = payload.secciones.reduce(
      (acc, s) => acc + s.vars.filter((v) => !v.default_include).length,
      0,
    );
    const percentReady = defaultIncludedCount
      ? Math.round((selectedVars / defaultIncludedCount) * 100)
      : 0;
    return {
      eligibleSections,
      includedSections,
      selectedVars,
      totalVars,
      nonDashboardVars,
      percentReady: Math.min(100, Math.max(0, percentReady)),
    };
  }, [defaultIncludedCount, includeVars, payload]);

  const toggleSection = (nombre: string) => {
    const section = payload?.secciones.find((s) => s.nombre === nombre);
    if (!section?.vars.some((v) => v.default_include)) return;
    const include = !includeSections.has(nombre);
    setIncludeSections((cur) => {
      const next = new Set(cur);
      if (include) next.add(nombre);
      else next.delete(nombre);
      return next;
    });
    if (section) {
      setIncludeVars((vars) => {
        const nextVars = new Set(vars);
        for (const v of section.vars) {
          if (include && v.default_include) nextVars.add(v.name);
          else nextVars.delete(v.name);
        }
        return nextVars;
      });
    }
  };

  const toggleVar = (name: string, enabled: boolean) => {
    if (!enabled) return;
    setIncludeVars((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const allSections = payload?.secciones ?? [];
      const excludeSections = allSections
        .filter((s) => !includeSections.has(s.nombre))
        .map((s) => s.nombre);
      const excludeVars = allSections.flatMap((s) =>
        s.vars.filter((v) => !includeVars.has(v.name)).map((v) => v.name),
      );
      await apiDashboardCurationPut({
        exclude_sections: excludeSections,
        exclude_vars: excludeVars,
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <EmptyState title="Preparando curaduría…" />;
  if (error && !payload) {
    return <EmptyState title="No se pudo cargar la curaduría" subtitle={error} />;
  }
  if (!payload || payload.secciones.length === 0) {
    return (
      <EmptyState
        title="No hay contenido para curar"
        subtitle="Carga XLSForm + base para preparar el dashboard."
      />
    );
  }

  return (
    <section className="dash-curation dash-cardbox">
      <div className="dash-cardbox-header">
        <div>
          <h2 className="dash-cardbox-title">
            Fase inicial: curar contenido
          </h2>
          <p className="dash-cardbox-help dash-cardbox-help--attached">
            Confirma qué secciones o variables deben incluirse en el dashboard.
          </p>
        </div>
      </div>

      <div className="dash-curation-body">
        <div className="dash-curation-main">
          <div className="dash-curation-summary">
            <Database size={15} aria-hidden="true" />
            <span>
              <strong>{defaultIncludedCount}</strong> variables marcadas por defecto:
              select_one y select_multiple. Las variables integer/decimal quedan
              fuera del tablero.
            </span>
          </div>

          {error && <div className="dash-curation-error">{error}</div>}

          <div className="dash-curation-list">
            {payload.secciones.map((section) => {
              const sectionEligible = section.vars.some((v) => v.default_include);
              const sectionIncluded = sectionEligible && includeSections.has(section.nombre);
              return (
                <section key={section.nombre} className="dash-curation-section">
                  <label className="dash-curation-section-head">
                    <input
                      type="checkbox"
                      checked={sectionIncluded}
                      disabled={!sectionEligible}
                      onChange={() => toggleSection(section.nombre)}
                    />
                    <span>
                      <strong>{section.nombre}</strong>
                      <small>{section.n_vars} variables</small>
                    </span>
                  </label>

                  <div className="dash-curation-vars">
                    {section.vars.map((v) => {
                      const checked =
                        sectionIncluded && v.default_include && includeVars.has(v.name);
                      return (
                        <label
                          key={v.name}
                          className={`dash-curation-var ${
                            v.default_include ? "is-default" : "is-muted"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!sectionIncluded || !v.default_include}
                            onChange={() => toggleVar(v.name, v.default_include)}
                          />
                          <span>
                            <span className="dash-curation-var-main">
                              <strong>{v.label || v.name}</strong>
                              <code>{v.name}</code>
                            </span>
                            {v.reason && <small>{v.reason}</small>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <aside className="dash-curation-aside" aria-label="Resumen de curaduría">
          <div className="dash-curation-panel">
            <div className="dash-curation-panel-head">
              <span className="dash-curation-panel-icon" aria-hidden="true">
                <LayoutDashboard size={18} />
              </span>
              <div>
                <strong>Preparación del dashboard</strong>
                <small>Selección base para construir las pestañas.</small>
              </div>
            </div>

            <div className="dash-curation-meter" aria-hidden="true">
              <span style={{ width: `${curationStats.percentReady}%` }} />
            </div>

            <div className="dash-curation-stats" aria-label="Estado de selección">
              <div className="dash-curation-stat">
                <CheckCircle2 size={14} aria-hidden="true" />
                <span>{curationStats.selectedVars}</span>
                <small>incluidas</small>
              </div>
              <div className="dash-curation-stat">
                <Columns3 size={14} aria-hidden="true" />
                <span>
                  {curationStats.includedSections}/{curationStats.eligibleSections}
                </span>
                <small>secciones</small>
              </div>
              <div className="dash-curation-stat">
                <Database size={14} aria-hidden="true" />
                <span>{curationStats.totalVars}</span>
                <small>variables</small>
              </div>
              <div className="dash-curation-stat">
                <LayoutDashboard size={14} aria-hidden="true" />
                <span>{curationStats.nonDashboardVars}</span>
                <small>no resumibles</small>
              </div>
            </div>

            <p className="dash-curation-note">
              Esta curaduría define qué entra al resumen, cruces, base tabular y
              vistas analíticas. Puedes excluir ruido sin modificar la base original.
            </p>

            <div className="dash-curation-actions">
              <button
                type="button"
                className="dash-primary-btn"
                onClick={save}
                disabled={saving}
              >
                {saving ? "Guardando…" : "Confirmar y construir dashboard"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
