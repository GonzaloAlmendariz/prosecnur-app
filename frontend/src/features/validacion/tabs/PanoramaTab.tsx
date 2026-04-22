import { useEffect, useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import { apiV2Panorama } from "../../../api/client";
import type { PanoramaSummary } from "../types";
import { useValidacionStore } from "../store";
import { LoadingBlock, EmptyState } from "../../../components/States";

// =============================================================================
// Panorama — vista de entrada de Fase 2
// =============================================================================
// Sprint 1: stub que muestra el estado de progreso y placeholders de los
// 3 bloques visuales que llegarán en Sprint 5 (KPIs de salud, top reglas
// violadas, top variables problemáticas).
//
// El tab escucha `baseNombre` y `version` del store y refetch cuando cambian.

export default function PanoramaTab() {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const [data, setData] = useState<PanoramaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError("");
    apiV2Panorama(baseNombre)
      .then((p) => {
        if (!cancel) setData(p);
      })
      .catch((e) => {
        if (!cancel) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
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

  const { progreso } = data;
  const pendiente =
    !progreso.plan_construido || !progreso.auditoria_corrida;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {pendiente && (
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
          <strong>Falta correr la validación.</strong> Para ver el panorama
          de salud de la base, ve a la pestaña{" "}
          <em>Reglas del instrumento</em> y ejecuta la auditoría.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <ProgresoPill
          label="Plan construido"
          on={progreso.plan_construido}
        />
        <ProgresoPill
          label="Auditoría corrida"
          on={progreso.auditoria_corrida}
        />
        <ProgresoPill
          label="Reglas personalizadas"
          on={progreso.n_reglas_custom > 0}
          counter={progreso.n_reglas_custom}
        />
      </div>

      <EmptyState
        icon={<Activity size={20} />}
        title="Los gráficos del panorama llegarán en Sprint 5"
        hint="Por ahora usa las otras pestañas para construir el plan, explorar los datos y crear reglas personalizadas."
      />
    </div>
  );
}

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
        border: `1px solid ${
          on ? "var(--pulso-success-border)" : "var(--pulso-border)"
        }`,
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
          border: `1px solid ${
            on ? "var(--pulso-success-border)" : "var(--pulso-border)"
          }`,
          color: on ? "var(--pulso-success-fg)" : "var(--pulso-text-soft)",
        }}
      >
        {counter != null ? counter : on ? "Listo" : "Pendiente"}
      </span>
    </div>
  );
}
