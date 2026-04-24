import { useEffect, useState, useCallback, useMemo } from "react";
import {
  AlertTriangle,
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
  apiV2InstrumentoReglaToggleActiva,
  apiV2InstrumentoResultado,
  downloadUrl,
  type InstrumentoDrillResult,
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
import ReglaDrillPanel from "../components/ReglaDrillPanel";
import { ContextLens, RuleNarrative } from "../components/v2";
import type { ReglaLike, VariableHoverData } from "../components/v2";

// =============================================================================
// InstrumentoTab — Sprint 2
// =============================================================================
// 3 pasos secuenciales:
//  1) Construir plan desde XLSForm (con include flags por defecto).
//  2) Ejecutar auditoría (async job).
//  3) Ver dashboard: KPIs + top reglas + heatmap + drill por regla.
//
// El deep-link desde Limpieza (prefill.instrumento.id_regla) se consume
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
  const [drill, setDrill] = useState<InstrumentoDrillResult | null>(null);
  const [reglaDirty, setReglaDirty] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string>("");

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

  useEffect(() => {
    if (!resultado?.resumen_tabla?.length) {
      setSelectedRuleId("");
      return;
    }
    if (!selectedRuleId) {
      const firstId = resultado.resumen_tabla[0]?.id_regla;
      if (typeof firstId === "string") setSelectedRuleId(firstId);
      return;
    }
    const exists = resultado.resumen_tabla.some((row) => row.id_regla === selectedRuleId);
    if (!exists) {
      const firstId = resultado.resumen_tabla[0]?.id_regla;
      setSelectedRuleId(typeof firstId === "string" ? firstId : "");
    }
  }, [resultado, selectedRuleId]);

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

  async function loadDrill(id: string) {
    setBusy(`Cargando casos de ${id}…`);
    setError("");
    try {
      const out = await apiV2InstrumentoDrill(id, baseNombre);
      return out;
    } finally {
      setBusy("");
    }
  }

  async function openDrill(id: string) {
    try {
      const out = await loadDrill(id);
      setDrill(out);
      setSelectedRuleId(id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function closeDrill() {
    setDrill(null);
    setReglaDirty(false);
  }

  async function onToggleReglaActiva(activa: boolean, ruleId?: string) {
    const id = ruleId ?? drill?.regla.id;
    if (!id) return;
    setBusy(activa ? "Reactivando regla…" : "Ignorando regla…");
    try {
      await apiV2InstrumentoReglaToggleActiva(id, activa, baseNombre);
      if (drill && drill.regla.id === id) {
        setDrill({ ...drill, regla: { ...drill.regla, activa } });
      }
      setReglaDirty(true);
      // El estado de auditoría se invalidó en el backend; refetch del estado.
      const e = await apiV2InstrumentoEstado(baseNombre);
      setEstado(e);
      setResultado(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const compactRules = useMemo(
    () => {
      const baseRows =
        resultado?.resumen_tabla
          .map(normalizeCompactRuleRow)
          .filter((row): row is CompactRuleRow => row !== null) ?? [];
      const duplicateCounts = new Map<string, number>();
      for (const row of baseRows) {
        const key = row.nombre.trim().toLowerCase();
        duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
      }
      return baseRows.map((row) => {
        const key = row.nombre.trim().toLowerCase();
        return {
          ...row,
          displayName: buildDisplayRuleName(row.nombre, row.variables[0]?.key ?? null, (duplicateCounts.get(key) ?? 0) > 1),
        };
      });
    },
    [resultado],
  );

  const activeDisplayName = useMemo(() => {
    if (!drill) return null;
    const fromList = compactRules.find((row) => row.id === drill.regla.id)?.displayName;
    return fromList ?? buildDisplayRuleName(drill.regla.nombre, getTargetVariableKey(drill.regla.variables), true);
  }, [compactRules, drill]);

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
            <PlotlyView view={resultado.top_reglas} height={560} />
            <PlotlyView view={resultado.heatmap} height={560} />
          </div>

          <section
            style={{
              padding: "16px 20px 20px",
              background: "white",
              border: "1px solid var(--pulso-border)",
              borderRadius: 10,
              boxShadow: "var(--pulso-shadow-low)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Explorar reglas con casos</div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--pulso-text-soft)",
                  marginTop: 2,
                  lineHeight: 1.5,
                }}
              >
                Cada tarjeta muestra la regla como narrativa. Pasa el mouse sobre una variable para ver su etiqueta completa, y haz click para abrir los casos.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                gap: 10,
                maxHeight: 480,
                overflow: "auto",
                paddingRight: 4,
              }}
            >
              {compactRules.map((row) => (
                <NarrativeRuleCard
                  key={row.id}
                  row={row}
                  selected={row.id === selectedRuleId}
                  onClick={() => {
                    setSelectedRuleId(row.id);
                    void openDrill(row.id);
                  }}
                />
              ))}
            </div>
          </section>
        </section>
      )}

      <ContextLens
        open={!!drill}
        onClose={closeDrill}
        variant="wide"
        title={activeDisplayName ?? drill?.regla.nombre ?? "Detalle de regla"}
        subtitle={drill?.regla.seccion ?? undefined}
      >
        {drill ? (
          // En vista panorama (Instrumento) no se ignora reglas — esa acción
          // vive en Limpieza, así que ocultamos el botón con
          // `showToggleActiva=false`. Y como el ContextLens ya tiene su
          // propio X de cerrar en el header, ocultamos también el botón
          // "Cerrar" interno del drill panel para no duplicar.
          <ReglaDrillPanel
            regla={drill.regla}
            displayName={activeDisplayName ?? undefined}
            casos={drill.casos}
            uuidCol={drill.uuid_col}
            onToggleActiva={onToggleReglaActiva}
            onClose={closeDrill}
            invalidatedHint={
              reglaDirty
                ? "Cambios aplicados. Vuelve a ejecutar la auditoría para actualizar KPIs y heatmap con el plan corregido."
                : undefined
            }
            surface="bubble"
            showToggleActiva={false}
            showClose={false}
          />
        ) : null}
      </ContextLens>

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
type CompactRuleRow = {
  id: string;
  nombre: string;
  displayName: string;
  tipo: string | null;
  seccion: string | null;
  porcentaje: number | null;
  nInconsistencias: number | null;
  variables: Array<{ key: string; label: string | null }>;
};

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

function normalizeCompactRuleRow(row: Record<string, unknown>): CompactRuleRow | null {
  const id = typeof row.id_regla === "string" ? row.id_regla : "";
  if (!id) return null;
  const variablePairs = [
    {
      key: typeof row.variable_1 === "string" ? row.variable_1 : "",
      label: typeof row.variable_1_etiqueta === "string" ? row.variable_1_etiqueta : null,
    },
    {
      key: typeof row.variable_2 === "string" ? row.variable_2 : "",
      label: typeof row.variable_2_etiqueta === "string" ? row.variable_2_etiqueta : null,
    },
    {
      key: typeof row.variable_3 === "string" ? row.variable_3 : "",
      label: typeof row.variable_3_etiqueta === "string" ? row.variable_3_etiqueta : null,
    },
  ].filter((item) => item.key);

  return {
    id,
    nombre: typeof row.nombre_regla === "string" ? row.nombre_regla : id,
    displayName: typeof row.nombre_regla === "string" ? row.nombre_regla : id,
    tipo: typeof row.tipo_observacion === "string" ? row.tipo_observacion : null,
    seccion: typeof row.seccion === "string" ? row.seccion : null,
    porcentaje: typeof row.porcentaje === "number" ? row.porcentaje : null,
    nInconsistencias: typeof row.n_inconsistencias === "number" ? row.n_inconsistencias : null,
    variables: variablePairs,
  };
}

function NarrativeRuleCard({
  row,
  selected,
  onClick,
}: {
  row: CompactRuleRow;
  selected: boolean;
  onClick: () => void;
}) {
  const rule = useMemo(() => compactRowToRule(row), [row]);
  const hoverLookup = useMemo(() => buildRowHoverLookup(row), [row]);
  return (
    <RuleNarrative
      rule={rule}
      variant="compact"
      selected={selected}
      onClick={onClick}
      nCasos={row.nInconsistencias ?? null}
      porcentaje={row.porcentaje ?? null}
      variableHoverLookup={hoverLookup}
      labelLookup={(v) => row.variables.find((x) => x.key === v)?.label ?? null}
    />
  );
}

function getTargetVariableKey(variables: Array<string | null | undefined>) {
  const first = variables.find((value) => typeof value === "string" && value.trim().length > 0);
  return typeof first === "string" ? first.trim() : null;
}

function buildDisplayRuleName(nombre: string, targetKey: string | null, disambiguate: boolean) {
  const base = nombre.trim() || "Regla sin nombre";
  if (!disambiguate || !targetKey) return base;
  if (base.toLowerCase().includes(`[${targetKey.toLowerCase()}]`)) return base;
  return `${base} [${targetKey}]`;
}

// ----------------------------------------------------------------------------
// Adaptadores a los componentes v2 (RuleNarrative, hovercards de variable).
// ----------------------------------------------------------------------------

// Mapea un CompactRuleRow al shape ReglaLike que consume RuleNarrative.
// Los labels por variable se pasan por separado al `labelLookup` de
// RuleNarrative (ver `buildRowHoverLookup` + labelLookup inline).
function compactRowToRule(row: CompactRuleRow): ReglaLike {
  const variables = row.variables.map((v) => v.key);
  const target = variables[0] ?? null;
  return {
    id: row.id,
    nombre: row.displayName,
    tipo_observacion: row.tipo ?? null,
    fuente: "instrumento",
    categoria_ux: row.tipo ?? null,
    variables,
    variable_roles: target ? { target } : null,
    n_casos: row.nInconsistencias ?? null,
    porcentaje: row.porcentaje ?? null,
  };
}

// Hover lookup para variables: sólo tiene el label por fila (no hay drill
// cargado). Suficiente para el listado — el ContextLens abre con datos
// completos al hacer click.
function buildRowHoverLookup(
  row: CompactRuleRow,
): (varName: string) => VariableHoverData | undefined {
  const byKey = new Map<string, string | null>();
  for (const v of row.variables) byKey.set(v.key, v.label);
  return (varName: string): VariableHoverData | undefined => {
    if (!varName) return undefined;
    const label = byKey.get(varName) ?? null;
    if (!label) return undefined;
    return { label, seccion: row.seccion ?? null };
  };
}

