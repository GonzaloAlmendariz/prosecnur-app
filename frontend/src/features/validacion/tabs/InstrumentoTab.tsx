import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Download,
  ListTree,
  Play,
  RefreshCcw,
  Upload,
} from "lucide-react";
import {
  apiUpload,
  apiV2InstrumentoAuditoria,
  apiV2InstrumentoBuildPlan,
  apiV2InstrumentoDrill,
  apiV2InstrumentoEstado,
  apiV2InstrumentoExportPlan,
  apiV2InstrumentoImportPlan,
  apiV2InstrumentoResultado,
  downloadUrl,
  type InstrumentoResultado,
} from "../../../api/client";
import type { InstrumentoEstado } from "../types";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
} from "../../../components/States";
import { JobProgress } from "../../../components/JobProgress";
import { useValidacionStore } from "../store";
import PlotlyView from "../components/PlotlyView";
import DrilldownTable from "../components/DrilldownTable";

// =============================================================================
// InstrumentoTab — Sprint 2
// =============================================================================
// 3 pasos secuenciales:
//  1) Construir plan desde XLSForm (con include flags por defecto).
//  2) Ejecutar auditoría (async job).
//  3) Ver dashboard: KPIs + top reglas + heatmap + drill por regla.
//
// El deep-link desde Panorama (prefill.instrumento.id_regla) se consume
// al montar el tab: abre el drill de esa regla automáticamente.

export default function InstrumentoTab() {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const prefillInstr = useValidacionStore((s) => s.prefill.instrumento);
  const clearPrefill = useValidacionStore((s) => s.clearPrefill);

  const [estado, setEstado] = useState<InstrumentoEstado | null>(null);
  const [resultado, setResultado] = useState<InstrumentoResultado | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [exportFileId, setExportFileId] = useState<string | null>(null);
  const [drill, setDrill] = useState<{
    id: string;
    rows: Array<Record<string, unknown>>;
  } | null>(null);

  // Carga inicial + refetch al cambiar base.
  const refetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const e = await apiV2InstrumentoEstado(baseNombre);
      setEstado(e);
      if (e.auditoria_corrida) {
        const r = await apiV2InstrumentoResultado(baseNombre);
        setResultado(r);
      } else {
        setResultado(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [baseNombre]);

  useEffect(() => {
    void refetchAll();
    // Reset local state al cambiar de base.
    setExportFileId(null);
    setDrill(null);
    setJobId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseNombre, version]);

  // Consumir prefill de deep-link: si viene id_regla, auto-abrir drill.
  useEffect(() => {
    if (prefillInstr?.id_regla && resultado) {
      void openDrill(prefillInstr.id_regla);
      clearPrefill("instrumento");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillInstr, resultado]);

  async function onBuildPlan() {
    setBusy("Construyendo plan desde el XLSForm…");
    setError("");
    try {
      await apiV2InstrumentoBuildPlan(baseNombre);
      await refetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onExport() {
    setBusy("Exportando plan a Excel…");
    setError("");
    try {
      const out = await apiV2InstrumentoExportPlan(baseNombre);
      setExportFileId(out.file_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onImport(file: File) {
    setBusy(`Importando ${file.name}…`);
    setError("");
    try {
      const up = await apiUpload(file, "plan_limpieza");
      await apiV2InstrumentoImportPlan(up.file_id, baseNombre);
      await refetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onAudit() {
    setError("");
    setDrill(null);
    setResultado(null);
    try {
      const out = await apiV2InstrumentoAuditoria(baseNombre);
      setJobId(out.job_id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onAuditDone() {
    setJobId(null);
    await refetchAll();
  }

  async function openDrill(id: string) {
    setBusy(`Cargando casos de ${id}…`);
    setError("");
    try {
      const out = await apiV2InstrumentoDrill(id, baseNombre);
      setDrill({ id, rows: out.detalle });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (loading) return <LoadingBlock label="Cargando estado…" />;
  if (!estado) {
    return (
      <EmptyState
        icon={<AlertTriangle size={20} />}
        title="Sin estado"
        hint="Carga una base primero."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* --- Paso 1: Construir plan --- */}
      <section
        style={{
          padding: "18px 20px",
          borderRadius: 12,
          background: "white",
          border: "1px solid var(--pulso-border)",
          boxShadow: "var(--pulso-shadow-low)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <StepHeader
          idx={1}
          title="Plan de reglas"
          subtitle="Extraído del XLSForm: required, relevant, constraint, calculate, choice_filter."
          done={estado.plan_construido}
          count={estado.plan_construido ? estado.n_reglas : null}
          countLabel="reglas"
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="pulso-primary"
            onClick={() => void onBuildPlan()}
            disabled={!!busy || !!jobId}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "8px 14px",
            }}
          >
            {estado.plan_construido ? <RefreshCcw size={12} /> : <ListTree size={12} />}
            {estado.plan_construido ? "Reconstruir plan" : "Construir plan"}
          </button>
          {estado.plan_construido && (
            <>
              <button
                type="button"
                onClick={() => void onExport()}
                disabled={!!busy}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  padding: "8px 14px",
                }}
              >
                <Download size={12} /> Exportar a Excel
              </button>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  padding: "8px 14px",
                  border: "1px solid var(--pulso-border)",
                  borderRadius: 6,
                  cursor: busy ? "wait" : "pointer",
                  background: "white",
                }}
              >
                <Upload size={12} /> Importar plan editado
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onImport(f);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </label>
            </>
          )}
        </div>
        {exportFileId && (
          <div
            style={{
              padding: "8px 12px",
              background: "var(--pulso-success-bg)",
              border: "1px solid var(--pulso-success-border)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--pulso-success-fg)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Plan exportado.{" "}
            <a
              href={downloadUrl(exportFileId)}
              style={{ color: "var(--pulso-primary)", fontWeight: 600 }}
            >
              Descargar →
            </a>
          </div>
        )}
      </section>

      {/* --- Paso 2: Ejecutar auditoría --- */}
      {estado.plan_construido && (
        <section
          style={{
            padding: "18px 20px",
            borderRadius: 12,
            background: "white",
            border: "1px solid var(--pulso-border)",
            boxShadow: "var(--pulso-shadow-low)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <StepHeader
            idx={2}
            title="Auditoría"
            subtitle="Corre el plan contra la data y encuentra casos inconsistentes."
            done={estado.auditoria_corrida}
          />
          <div>
            <button
              type="button"
              className="pulso-primary"
              onClick={() => void onAudit()}
              disabled={!!busy || !!jobId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "8px 14px",
              }}
            >
              <Play size={12} />
              {estado.auditoria_corrida ? "Ejecutar de nuevo" : "Ejecutar auditoría"}
            </button>
          </div>
          {jobId && (
            <JobProgress
              label="Auditando data"
              jobId={jobId}
              onDone={() => void onAuditDone()}
              onError={(msg) => {
                setError(msg);
                setJobId(null);
              }}
              onCancelled={() => setJobId(null)}
            />
          )}
        </section>
      )}

      {/* --- Paso 3: Dashboard de resultado --- */}
      {estado.auditoria_corrida && resultado && (
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <StepHeader idx={3} title="Resultados" done={true} />

          {/* KPIs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {resultado.kpis.map((k, i) => (
              <PlotlyView key={i} view={k} />
            ))}
          </div>

          {/* Top reglas + heatmap lado a lado en pantallas grandes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
              gap: 16,
            }}
          >
            <PlotlyView
              view={resultado.top_reglas}
              onAction={(a) => {
                if (a.id === "drill_regla" && a.payload?.id) {
                  void openDrill(String(a.payload.id));
                }
              }}
            />
            <PlotlyView view={resultado.heatmap} />
          </div>

          {/* Drill inline si hay regla seleccionada */}
          {drill && (
            <DrillPanel
              id={drill.id}
              rows={drill.rows}
              onClose={() => setDrill(null)}
            />
          )}

          {/* Tabla completa del resumen (drill por click en fila) */}
          <section
            style={{
              padding: "16px 20px",
              background: "white",
              border: "1px solid var(--pulso-border)",
              borderRadius: 10,
              boxShadow: "var(--pulso-shadow-low)",
            }}
          >
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                Reglas con casos
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--pulso-text-soft)",
                  marginTop: 2,
                }}
              >
                Click en una fila para ver los casos inconsistentes de esa regla.
              </div>
            </div>
            <DrilldownTable
              rows={resultado.resumen_tabla}
              preferredOrder={[
                "id_regla",
                "nombre_regla",
                "tipo_observacion",
                "seccion",
                "n_inconsistencias",
                "tabla",
                "porcentaje",
              ]}
              onRowClick={(row) => {
                const id = row.id_regla as string | undefined;
                if (id) void openDrill(id);
              }}
              emptyHint="Ninguna regla reportó casos — todo OK."
            />
          </section>
        </section>
      )}

      {busy && (
        <div style={{ marginTop: 4 }}>
          <LoadingBlock variant="inline" label={busy} />
        </div>
      )}
      {error && <ErrorBlock label="Error" detail={error} />}
    </div>
  );
}

// -----------------------------------------------------------------------------
function StepHeader({
  idx,
  title,
  subtitle,
  done,
  count,
  countLabel,
}: {
  idx: number;
  title: string;
  subtitle?: string;
  done: boolean;
  count?: number | null;
  countLabel?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: done ? "var(--pulso-success-fg)" : "var(--pulso-text-soft)",
          color: "white",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {idx}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--pulso-text)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {title}
          {count != null && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--pulso-primary-soft)",
                color: "var(--pulso-primary)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {count} {countLabel}
            </span>
          )}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 11,
              color: "var(--pulso-text-soft)",
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
function DrillPanel({
  id,
  rows,
  onClose,
}: {
  id: string;
  rows: Array<Record<string, unknown>>;
  onClose: () => void;
}) {
  return (
    <section
      style={{
        padding: "16px 20px",
        background: "var(--pulso-primary-soft)",
        border: "1px solid var(--pulso-primary-border)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <ArrowRight size={14} color="var(--pulso-primary)" />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--pulso-primary)",
            }}
          >
            Casos de la regla <code>{id}</code>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--pulso-text-soft)",
              marginTop: 2,
            }}
          >
            {rows.length} caso{rows.length !== 1 ? "s" : ""} listado{rows.length !== 1 ? "s" : ""}.
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            fontSize: 12,
            padding: "6px 10px",
            border: "1px solid var(--pulso-border)",
            background: "white",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Cerrar
        </button>
      </div>
      <DrilldownTable rows={rows} emptyHint="Sin casos en esta regla." />
    </section>
  );
}
