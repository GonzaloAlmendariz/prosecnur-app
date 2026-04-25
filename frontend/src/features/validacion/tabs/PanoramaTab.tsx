import { useEffect, useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";
// TODO(sprint-5): cuando exista, importar de la fuente real:
//   import { apiV2Panorama } from "../../../api/client";
//   import type { PanoramaSummary } from "../types";
// Hasta entonces, stub local que tipifica correctamente la respuesta
// esperada (reusa `ViewDescriptor` que ya existe). La lógica UI queda
// intacta y se conecta sola cuando el endpoint y el tipo aterricen.
import type { ValidacionTabId, ViewDescriptor } from "../types";
type PanoramaProgreso = {
  plan_construido: boolean;
  auditoria_corrida: boolean;
  n_reglas_custom: number;
};
type PanoramaSummary = {
  progreso: PanoramaProgreso;
  kpis: ViewDescriptor[];
  top_reglas: ViewDescriptor | null;
  top_variables: ViewDescriptor | null;
};
async function apiV2Panorama(_baseNombre: string | null): Promise<PanoramaSummary> {
  throw new Error("apiV2Panorama: pendiente de implementación (Sprint 5)");
}
import { useValidacionStore } from "../store";
import { LoadingBlock, EmptyState } from "../../../components/States";
import PlotlyView from "../components/PlotlyView";

// =============================================================================
// Panorama — vista de entrada de Fase 2 (Sprint 5)
// =============================================================================
// Muestra un dashboard consolidado con:
//   - Checklist de progreso (3 pills: plan construido / auditoría corrida /
//     reglas personalizadas).
//   - KPIs de salud (total inconsistencias, reglas con casos, reglas custom).
//   - Top 5 reglas violadas — clickable → salta a Instrumento con drill.
//   - Top 5 variables problemáticas — clickable → salta a Explorar.
//
// Deep-links: cada ViewDescriptor trae `actions` con `target_tab` y
// `target_payload`. Al clickear en una barra, usamos el customdata del
// punto como id y disparamos `jumpTo(tab, prefill)` en el store.

export default function PanoramaTab() {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const jumpTo = useValidacionStore((s) => s.jumpTo);

  const [data, setData] = useState<PanoramaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError("");
    apiV2Panorama(baseNombre)
      .then((p: PanoramaSummary) => { if (!cancel) setData(p); })
      .catch((e: unknown) => { if (!cancel) setError((e as Error).message); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [baseNombre, version]);

  if (loading) return <LoadingBlock label="Cargando panorama…" />;
  if (error)
    return (
      <EmptyState
        icon={<AlertTriangle size={20} />}
        title="No se pudo cargar el panorama"
        hint={error}
      />
    );
  if (!data) return null;

  const { progreso, kpis, top_reglas, top_variables } = data;
  const falta_auditoria = !progreso.auditoria_corrida;

  // Handler universal para acciones de descriptors (deep-link cross-tab).
  function handleAction(a: {
    id: string;
    target_tab?: string;
    payload?: Record<string, unknown>;
  }) {
    const tab = a.target_tab as ValidacionTabId | undefined;
    if (!tab) return;
    const payloadRaw = (a.payload ?? {}) as Record<string, unknown>;
    // Mapear id de acción → shape esperado por el prefill del tab destino.
    let prefill: Record<string, unknown> = {};
    if (a.id === "drill_regla" && typeof payloadRaw.id === "string") {
      prefill = { id_regla: payloadRaw.id };
    } else if (a.id === "open_variable" && typeof payloadRaw.id === "string") {
      prefill = { var: payloadRaw.id };
    } else {
      prefill = payloadRaw;
    }
    jumpTo(tab, prefill);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Banner si falta correr auditoría */}
      {falta_auditoria && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 10,
            background: "var(--pulso-info-bg)",
            border: "1px solid var(--pulso-info-border)",
            color: "var(--pulso-info-fg)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong>Falta correr la validación.</strong>{" "}
          Ve a la pestaña <em>Reglas del instrumento</em> y ejecuta la
          auditoría para ver KPIs de salud y top de problemas.
        </div>
      )}

      {/* Checklist de progreso */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <ProgresoPill label="Plan construido" on={progreso.plan_construido} />
        <ProgresoPill label="Auditoría corrida" on={progreso.auditoria_corrida} />
        <ProgresoPill
          label="Reglas personalizadas"
          on={progreso.n_reglas_custom > 0}
          counter={progreso.n_reglas_custom}
        />
      </div>

      {/* KPIs consolidados */}
      {kpis.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {kpis.map((k: ViewDescriptor, i: number) => <PlotlyView key={i} view={k} />)}
        </div>
      )}

      {/* Top reglas + top variables lado a lado en pantallas grandes */}
      {(top_reglas || top_variables) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
            gap: 16,
          }}
        >
          {top_reglas && <PlotlyView view={top_reglas} onAction={handleAction} />}
          {top_variables && <PlotlyView view={top_variables} onAction={handleAction} />}
        </div>
      )}

      {/* Fallback si no hay kpis ni tops */}
      {kpis.length === 0 && !top_reglas && !top_variables && (
        <EmptyState
          icon={<Activity size={20} />}
          title="Panorama vacío"
          hint="Construye el plan del instrumento y corre la auditoría para ver la salud de la base aquí."
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
function ProgresoPill({
  label,
  on,
  counter,
}: {
  label: string;
  on: boolean;
  counter?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        borderRadius: 10,
        background: on ? "var(--pulso-success-bg)" : "var(--pulso-surface-2)",
        border: `1px solid ${on ? "var(--pulso-success-border)" : "var(--pulso-border)"}`,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: on ? "var(--pulso-success-fg)" : "var(--pulso-text-soft)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 999,
          background: "white",
          border: `1px solid ${on ? "var(--pulso-success-border)" : "var(--pulso-border)"}`,
          color: on ? "var(--pulso-success-fg)" : "var(--pulso-text-soft)",
        }}
      >
        {counter != null ? counter : on ? "Listo" : "Pendiente"}
      </span>
    </div>
  );
}
