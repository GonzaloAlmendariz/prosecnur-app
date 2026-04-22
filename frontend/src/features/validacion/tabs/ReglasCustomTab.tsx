import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Eye,
  EyeOff,
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
  ExploradorVariablesList,
  ReglaCustom,
  ReglasCustomList,
} from "../types";
import { useValidacionStore } from "../store";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import { JobProgress } from "../../../components/JobProgress";
import ReglaEditor from "../components/ReglaEditor";

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

  const [list, setList] = useState<ReglasCustomList | null>(null);
  const [inv, setInv] = useState<ExploradorVariablesList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [editing, setEditing] = useState<ReglaCustom | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

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

  async function handleSubmit(payload: Omit<ReglaCustom, "id" | "created_at"> & { id?: string }) {
    setBusy("Guardando regla…");
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
    setBusy(r.activa ? "Desactivando…" : "Activando…");
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
    try {
      const out = await apiV2ReglasCustomEjecutar(baseNombre);
      setJobId(out.job_id);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header + acciones */}
      <section
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
            {reglas.length} regla{reglas.length === 1 ? "" : "s"} personalizada{reglas.length === 1 ? "" : "s"}
            {nActivas !== reglas.length && (
              <span style={{ fontWeight: 400, color: "var(--pulso-text-soft)", marginLeft: 6 }}>
                · {nActivas} activa{nActivas === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.5 }}>
            Las reglas activas se corren junto con las del instrumento al ejecutarlas, y aparecen en el resultado del tab Instrumento con id <code>RC_*</code>.
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
          <Plus size={12} /> Nueva regla
        </button>
        <button
          type="button"
          onClick={() => void handleEjecutar()}
          disabled={!!busy || !!jobId || nActivas === 0}
          title={nActivas === 0 ? "No hay reglas activas" : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            padding: "8px 14px",
            border: "1px solid var(--pulso-success-border)",
            background: nActivas > 0 ? "var(--pulso-success-bg)" : "var(--pulso-surface-2)",
            color: nActivas > 0 ? "var(--pulso-success-fg)" : "var(--pulso-text-soft)",
            borderRadius: 6,
            cursor: nActivas === 0 ? "not-allowed" : "pointer",
            opacity: nActivas === 0 ? 0.6 : 1,
          }}
        >
          <Play size={12} /> Ejecutar {nActivas > 0 ? `(${nActivas})` : ""}
        </button>
      </section>

      {jobId && (
        <JobProgress
          label="Ejecutando reglas personalizadas"
          jobId={jobId}
          onDone={() => { setJobId(null); void refetch(); }}
          onError={(msg) => { setError(msg); setJobId(null); }}
          onCancelled={() => setJobId(null)}
        />
      )}

      {/* Editor inline */}
      {showEditor && (
        <ReglaEditor
          inv={inv}
          inicial={editing}
          onSubmit={handleSubmit}
          onCancel={() => { setShowEditor(false); setEditing(null); }}
        />
      )}

      {/* Lista */}
      {reglas.length === 0 && !showEditor && (
        <EmptyState
          icon={<PieChart size={20} />}
          title="Sin reglas personalizadas todavía"
          hint="Usa 'Nueva regla' para crear reglas más finas: rangos, outliers, duplicados, coherencia entre variables, valores fuera de catálogo."
        />
      )}

      {reglas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reglas.map((r) => (
            <ReglaRow
              key={r.id}
              regla={r}
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
    </div>
  );
}

// =============================================================================
// Row
// =============================================================================
function ReglaRow({
  regla,
  onToggle,
  onEdit,
  onDelete,
  busy,
}: {
  regla: ReglaCustom;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const tipoColors: Record<string, { bg: string; fg: string }> = {
    no_nulo: { bg: "#fef3c7", fg: "#92400e" },
    rango_num: { bg: "#dbeafe", fg: "#1e40af" },
    rango_fecha: { bg: "#fae8ff", fg: "#86198f" },
    outliers_iqr: { bg: "#fce7f3", fg: "#9f1239" },
    outliers_z: { bg: "#fce7f3", fg: "#9f1239" },
    duplicados: { bg: "#ede9fe", fg: "#5b21b6" },
    fuera_catalogo: { bg: "#d1fae5", fg: "#065f46" },
    coherencia_2v: { bg: "#fef3c7", fg: "#78350f" },
  };
  const t = tipoColors[regla.tipo] ?? { bg: "var(--pulso-surface-2)", fg: "var(--pulso-text-soft)" };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 14px",
        borderRadius: 10,
        background: regla.activa ? "white" : "var(--pulso-surface-2)",
        border: `1px solid ${regla.activa ? "var(--pulso-border)" : "var(--pulso-border)"}`,
        opacity: regla.activa ? 1 : 0.7,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          fontSize: 10,
          fontWeight: 700,
          padding: "3px 8px",
          borderRadius: 999,
          background: t.bg,
          color: t.fg,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {regla.tipo.replace("_", " ")}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-text)" }}>
          {regla.nombre}
        </div>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.4 }}>
          {regla.variables.map((v) => (
            <code
              key={v}
              style={{
                fontFamily: "ui-monospace, monospace",
                background: "var(--pulso-surface-2)",
                padding: "1px 5px",
                borderRadius: 3,
                marginRight: 4,
              }}
            >
              {v}
            </code>
          ))}
          {regla.mensaje && regla.mensaje !== regla.nombre && (
            <span style={{ marginLeft: 8 }}>· {regla.mensaje}</span>
          )}
        </div>
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--pulso-text-soft)",
          fontFamily: "ui-monospace, monospace",
          padding: "3px 8px",
          background: "var(--pulso-surface-2)",
          borderRadius: 4,
        }}
      >
        {regla.id}
      </span>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <IconBtn
          onClick={onToggle}
          disabled={busy}
          icon={regla.activa ? <EyeOff size={12} /> : <Eye size={12} />}
          title={regla.activa ? "Desactivar" : "Activar"}
        />
        <IconBtn onClick={onEdit} disabled={busy} icon={<Pencil size={12} />} title="Editar" />
        <IconBtn onClick={onDelete} disabled={busy} icon={<Trash2 size={12} />} title="Eliminar" danger />
      </div>
    </div>
  );
}

function IconBtn({
  onClick,
  disabled,
  icon,
  title,
  danger,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 6,
        border: `1px solid ${danger ? "var(--pulso-border)" : "var(--pulso-border)"}`,
        background: "white",
        color: danger ? "var(--pulso-text-soft)" : "var(--pulso-text-soft)",
        cursor: disabled ? "wait" : "pointer",
        transition: "background 120ms ease, color 120ms ease",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (danger) {
          (e.currentTarget as HTMLElement).style.background = "var(--pulso-danger-bg)";
          (e.currentTarget as HTMLElement).style.color = "var(--pulso-danger-fg)";
        } else {
          (e.currentTarget as HTMLElement).style.background = "var(--pulso-primary-soft)";
          (e.currentTarget as HTMLElement).style.color = "var(--pulso-primary)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "white";
        (e.currentTarget as HTMLElement).style.color = "var(--pulso-text-soft)";
      }}
    >
      {icon}
    </button>
  );
}
