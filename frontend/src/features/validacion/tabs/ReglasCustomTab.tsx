import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Pencil,
  PieChart,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import {
  apiV2ExplorarVariables,
  apiV2ReglasCustomCreate,
  apiV2ReglasCustomDelete,
  apiV2ReglasCustomEjecutar,
  apiV2ReglasCustomList,
  apiV2ReglasCustomUpdate,
} from "../../../api/client";
import type {
  ExploradorVariable,
  ExploradorVariablesList,
  ReglaCustom,
  ReglasCustomList,
} from "../types";
import { useValidacionStore } from "../store";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import { JobProgress } from "../../../components/JobProgress";
import ReglaEditor from "../components/ReglaEditor";
import { RuleNarrative } from "../components/v2";
import type { VariableHoverData } from "../components/v2";
import { customRuleToRule } from "../customRuleNarrative";

// =============================================================================
// ReglasCustomTab — Sprint 4
// =============================================================================
// Lista de reglas custom con toggle activa, editar, eliminar y botón
// "Ejecutar reglas activas" que corre un job async. El resultado queda
// guardado como `evaluacion` en el scope — el usuario puede ir a Instrumento
// para ver KPIs / heatmap con las reglas custom mezcladas.

export default function ReglasCustomTab() {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const bumpVersion = useValidacionStore((s) => s.bumpVersion);
  const jumpTo = useValidacionStore((s) => s.jumpTo);

  const [list, setList] = useState<ReglasCustomList | null>(null);
  const [inv, setInv] = useState<ExploradorVariablesList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [editing, setEditing] = useState<ReglaCustom | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [runSummary, setRunSummary] = useState<{ total: number | null; nCustom: number | null } | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [l, i] = await Promise.all([
        apiV2ReglasCustomList(baseNombre),
        apiV2ExplorarVariables(baseNombre),
      ]);
      setList(l);
      setInv(i);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [baseNombre]);

  useEffect(() => {
    void refetch();
    setShowEditor(false);
    setEditing(null);
    setJobId(null);
  }, [refetch, version]);

  // IMPORTANTE: este useMemo va arriba de los early returns. Si vive
  // después de `if (loading) return ...` los hooks se llaman
  // condicionalmente entre renders → React #310 ("Rendered more hooks
  // than during the previous render") y la app se cae con pantalla
  // gris al cambiar `loading` de true a false.
  const flatVars: VarWithSection[] = useMemo(() => {
    if (!inv) return [];
    const out: VarWithSection[] = [];
    for (const sec of inv.secciones) {
      for (const v of sec.variables) out.push({ ...v, seccion: sec.nombre });
    }
    return out;
  }, [inv]);

  async function handleSubmit(payload: Omit<ReglaCustom, "id" | "created_at"> & { id?: string }) {
    setBusy("Guardando regla…");
    setRunSummary(null);
    try {
      if (payload.id) {
        await apiV2ReglasCustomUpdate(payload.id, payload, baseNombre);
      } else {
        await apiV2ReglasCustomCreate(payload, baseNombre);
      }
      setShowEditor(false);
      setEditing(null);
      await refetch();
    } finally {
      setBusy("");
    }
  }

  async function handleToggle(r: ReglaCustom) {
    setBusy(r.activa ? "Quitando de la ejecución…" : "Incluyendo en la ejecución…");
    setRunSummary(null);
    try {
      await apiV2ReglasCustomUpdate(r.id, { activa: !r.activa }, baseNombre);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function handleDelete(r: ReglaCustom) {
    if (!window.confirm(`¿Eliminar la regla "${r.nombre}"? No se puede deshacer.`)) return;
    setBusy("Eliminando…");
    setRunSummary(null);
    try {
      await apiV2ReglasCustomDelete(r.id, baseNombre);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function handleEjecutar() {
    setBusy("Lanzando ejecución…");
    setError("");
    setRunSummary(null);
    try {
      const out = await apiV2ReglasCustomEjecutar(baseNombre);
      setJobId(out.job_id);
      setRunSummary({ total: null, nCustom: out.n_custom ?? nActivas });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (loading) return <LoadingBlock label="Cargando reglas…" />;
  if (!list || !inv) {
    return (
      <EmptyState
        icon={<AlertTriangle size={20} />}
        title="No se pudo cargar"
        hint={error || "Estado desconocido."}
      />
    );
  }

  const reglas = list.reglas;
  const nActivas = reglas.filter((r) => r.activa).length;
  // (flatVars se calcula arriba, antes de los early returns, para
  // mantener el orden de hooks estable entre renders.)

  const panelContent = (
    <>
      {/* Header + acciones */}
      <section
        className="pulso-criterios-toolbar"
        style={{
          padding: "14px 18px",
          background: "white",
          border: "1px solid var(--pulso-border)",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {reglas.length} criterio{reglas.length === 1 ? "" : "s"} de revisión
            {nActivas !== reglas.length && (
              <span style={{ fontWeight: 400, color: "var(--pulso-text-soft)", marginLeft: 6 }}>
                · {nActivas} se ejecuta{nActivas === 1 ? "" : "n"}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.5 }}>
            Configura señales adicionales sobre la base y envía los registros detectados a Limpieza y transformación.
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowEditor(true); }}
          className="pulso-primary"
          disabled={!!busy || !!jobId}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            padding: "8px 14px",
          }}
        >
          <Plus size={12} /> Nuevo criterio
        </button>
        <button
          type="button"
          className="pulso-vv2-pill"
          onClick={() => void handleEjecutar()}
          disabled={!!busy || !!jobId || nActivas === 0}
          title={nActivas === 0 ? "No hay criterios incluidos para ejecutar" : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            padding: "8px 14px",
            border: "1px solid var(--pulso-success-border)",
            background: nActivas > 0 ? "var(--pulso-success-bg)" : "var(--pulso-surface-2)",
            color: nActivas > 0 ? "var(--pulso-success-fg)" : "var(--pulso-text-soft)",
            cursor: nActivas === 0 ? "not-allowed" : "pointer",
            opacity: nActivas === 0 ? 0.6 : 1,
          }}
        >
          <Play size={12} /> Ejecutar {nActivas > 0 ? `(${nActivas})` : ""}
        </button>
      </section>

      {jobId && (
        <JobProgress
          label="Ejecutando criterios de revisión"
          jobId={jobId}
          onDone={(data: { total_inconsistencias?: number | null }) => {
            setJobId(null);
            setRunSummary({
              total: typeof data?.total_inconsistencias === "number" ? data.total_inconsistencias : null,
              nCustom: runSummary?.nCustom ?? nActivas,
            });
            bumpVersion();
            void refetch();
          }}
          onError={(msg) => { setError(msg); setJobId(null); }}
          onCancelled={() => setJobId(null)}
        />
      )}

      {runSummary && !jobId && (
        <div className="pulso-criterios-run-summary">
          <div>
            <strong>Criterios ejecutados.</strong>
            <span>
              {runSummary.total == null
                ? "La revisión terminó y actualizó los hallazgos disponibles."
                : `${runSummary.total} hallazgo${runSummary.total === 1 ? "" : "s"} disponible${runSummary.total === 1 ? "" : "s"} para revisar en Limpieza y normalización.`}
            </span>
          </div>
          <button
            type="button"
            className="pulso-secondary pulso-criterios-summary-action"
            onClick={() => jumpTo("limpieza", { source: "reglas_custom", at: Date.now() })}
          >
            Ver en limpieza <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Editor inline */}
      {showEditor && (
        <div className="pulso-criterios-editor-slot">
          <ReglaEditor
            inv={inv}
            baseNombre={baseNombre}
            inicial={editing}
            onSubmit={handleSubmit}
            onCancel={() => { setShowEditor(false); setEditing(null); }}
          />
        </div>
      )}

      {/* Lista */}
      {reglas.length === 0 && !showEditor && (
        <div className="pulso-criterios-empty">
          <EmptyState
            icon={<PieChart size={20} />}
            title="Sin criterios de revisión todavía"
            hint="Crea señales para duración corta, coherencias de campo, duplicados operativos o patrones de selección múltiple."
          />
        </div>
      )}

      {reglas.length > 0 && (
        <div className="pulso-criterios-list">
          {reglas.map((r) => (
            <ReglaRow
              key={r.id}
              regla={r}
              flatVars={flatVars}
              onToggle={() => handleToggle(r)}
              onEdit={() => { setEditing(r); setShowEditor(true); }}
              onDelete={() => handleDelete(r)}
              busy={!!busy}
            />
          ))}
        </div>
      )}

      {busy && <LoadingBlock variant="inline" label={busy} />}
      {error && <ErrorBlock label="Error" detail={error} />}
    </>
  );

  const rootClassName = `pulso-criterios-tab${showEditor ? " is-editing" : ""}`;
  if (error) {
    return <div className={rootClassName}>{panelContent}</div>;
  }

  return (
    <div className={rootClassName} data-audit-ready="validacion-reglas_custom">
      {panelContent}
    </div>
  );
}

// Inventario de una variable con la sección de origen añadida.
type VarWithSection = ExploradorVariable & { seccion: string };

// =============================================================================
// Row — RuleNarrative compact + chip con id + acciones a la derecha.
// Las reglas inactivas se ven atenuadas (opacidad + surface distinto) pero
// mantienen el narrative legible.
// =============================================================================
function ReglaRow({
  regla,
  flatVars,
  onToggle,
  onEdit,
  onDelete,
  busy,
}: {
  regla: ReglaCustom;
  flatVars: VarWithSection[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const rule = useMemo(() => customRuleToRule(regla), [regla]);
  const hoverLookup = useMemo(
    () => buildVarHoverLookup(flatVars),
    [flatVars],
  );
  const labelLookup = useMemo(
    () => (v: string) => flatVars.find((x) => x.name === v)?.label ?? null,
    [flatVars],
  );

  return (
    <div className={`pulso-criterio-row${regla.activa ? " is-included" : " is-omitted"}`}>
      {/* Narrativa ocupa todo lo que pueda */}
      <div className="pulso-criterio-main">
        <RuleNarrative
          rule={rule}
          variant="compact"
          variableHoverLookup={hoverLookup}
          labelLookup={labelLookup}
          // Hovercards desactivados en la lista: con muchas reglas, los
          // portals + listeners de scroll se acumulaban y crasheaban la
          // app. El detalle por variable se ve en el editor (preview
          // narrativo) cuando se hace click en "Editar".
          disableVariableHover
        />
        <div className="pulso-criterio-treatment">
          <span>Tratamiento</span>
          <strong>{plannedActionLabel(plannedActionValue(regla))}</strong>
          <em>{plannedScopeLabel(regla.recommended_scope, regla)}</em>
        </div>
      </div>

      {/* Columna lateral: id chip arriba + acciones abajo */}
      <div className="pulso-criterio-side">
        <div className={`pulso-criterio-state${regla.activa ? " is-active" : " is-muted"}`}>
          <span className="pulso-criterio-state-icon">
            {regla.activa ? <CheckCircle2 size={14} /> : <CircleOff size={14} />}
          </span>
          <span className="pulso-criterio-state-copy">
            <strong>{regla.activa ? "Se ejecuta" : "No se ejecuta"}</strong>
            <small>{regla.activa ? "Incluido al ejecutar" : "Omitido por ahora"}</small>
          </span>
          <span className="pulso-criterio-id">{regla.id}</span>
        </div>
        <div className="pulso-criterio-actions">
          <RowActionButton
            onClick={onToggle}
            disabled={busy}
            icon={regla.activa ? <CircleOff size={14} /> : <CheckCircle2 size={14} />}
            label={regla.activa ? "Omitir de ejecución" : "Incluir en ejecución"}
            title={regla.activa ? "No ejecutar este criterio" : "Incluir al ejecutar"}
            tone={regla.activa ? "neutral" : "primary"}
          />
          <RowActionButton onClick={onEdit} disabled={busy} icon={<Pencil size={14} />} label="Editar" title="Editar criterio" />
          <RowActionButton onClick={onDelete} disabled={busy} icon={<Trash2 size={14} />} label="Eliminar" title="Eliminar criterio" tone="danger" />
        </div>
      </div>
    </div>
  );
}

// Hover lookup genérico desde el inventario — label + sección.
function buildVarHoverLookup(
  flatVars: VarWithSection[],
): (varName: string) => VariableHoverData | undefined {
  const byName = new Map<string, VarWithSection>();
  for (const v of flatVars) byName.set(v.name, v);
  return (varName: string): VariableHoverData | undefined => {
    if (!varName) return undefined;
    const v = byName.get(varName);
    if (!v) return undefined;
    return {
      label: v.label ?? null,
      seccion: v.seccion ?? null,
    };
  };
}

function RowActionButton({
  onClick,
  disabled,
  icon,
  label,
  title,
  tone = "neutral",
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  title: string;
  tone?: "neutral" | "primary" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`pulso-criterio-action is-${tone}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function plannedActionLabel(value: ReglaCustom["planned_action_type"]) {
  switch (value) {
    case "replace_value":
      return "Corregir valor";
    case "set_value":
      return "Asignar valor";
    case "recode_map":
      return "Recodificar";
    case "complete_select_multiple_hierarchy":
      return "Completar selección";
    case "adjust_select_multiple":
      return "Ajustar selección";
    case "nullify_fields":
      return "Anular campos";
    case "exclude_cases":
      return "Excluir registros";
    case "ignore_rule":
    default:
      return "Registrar";
  }
}

function plannedActionValue(regla: ReglaCustom): ReglaCustom["planned_action_type"] {
  if (regla.planned_action_type) return regla.planned_action_type;
  switch (regla.tipo) {
    case "select_multiple_hierarchy":
      return "complete_select_multiple_hierarchy";
    case "select_multiple_exclusive":
    case "select_multiple_cardinality":
    case "select_multiple_selection":
      return "adjust_select_multiple";
    case "duplicados":
      return "exclude_cases";
    case "fuera_catalogo":
      return "recode_map";
    case "no_nulo":
      return "set_value";
    default:
      return "ignore_rule";
  }
}

function plannedScopeLabel(value: ReglaCustom["recommended_scope"], regla?: ReglaCustom) {
  const resolved = value ?? defaultScopeForRule(regla);
  switch (resolved) {
    case "all":
      return "todos";
    case "selected":
      return "selección";
    case "single":
      return "uno por uno";
    default:
      return "definible en Limpieza";
  }
}

function defaultScopeForRule(regla?: ReglaCustom): ReglaCustom["recommended_scope"] {
  switch (regla?.tipo) {
    case "select_multiple_hierarchy":
    case "fuera_catalogo":
      return "all";
    case "select_multiple_exclusive":
    case "select_multiple_cardinality":
    case "select_multiple_selection":
    case "duplicados":
    case "no_nulo":
      return "selected";
    case "rango_num":
    case "rango_fecha":
    case "coherencia_2v":
      return "single";
    default:
      return undefined;
  }
}
