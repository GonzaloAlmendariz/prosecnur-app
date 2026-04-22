import { useEffect, useState } from "react";
import { AlertTriangle, ListTree } from "lucide-react";
import { apiV2InstrumentoEstado } from "../../../api/client";
import type { InstrumentoEstado } from "../types";
import { useValidacionStore } from "../store";
import { LoadingBlock, EmptyState } from "../../../components/States";

// =============================================================================
// Instrumento — validación contra reglas derivadas del XLSForm
// =============================================================================
// Sprint 1: stub que muestra estado (plan construido sí/no, auditoría sí/no).
// Sprint 2 agrega: botones construir plan → ejecutar auditoría → dashboard
// visual con KPIs, bar_h top reglas, heatmap sección×tipo, drill por regla.

export default function InstrumentoTab() {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const prefillInstr = useValidacionStore((s) => s.prefill.instrumento);
  const clearPrefill = useValidacionStore((s) => s.clearPrefill);
  const [estado, setEstado] = useState<InstrumentoEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    apiV2InstrumentoEstado(baseNombre)
      .then((e) => {
        if (!cancel) setEstado(e);
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

  // Consumir prefill de deep-link una vez que se muestre este tab.
  useEffect(() => {
    if (prefillInstr?.id_regla) {
      // Sprint 2 usará esto para abrir drill-down automático.
      // Por ahora solo logeamos y limpiamos.
      // eslint-disable-next-line no-console
      console.log("InstrumentoTab prefill:", prefillInstr);
      clearPrefill("instrumento");
    }
  }, [prefillInstr, clearPrefill]);

  if (loading) return <LoadingBlock label="Cargando estado del instrumento…" />;
  if (error)
    return (
      <EmptyState icon={<AlertTriangle size={20} />} title="Error" hint={error} />
    );
  if (!estado) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <EmptyState
        icon={<ListTree size={20} />}
        title="Reglas del instrumento — pendiente Sprint 2"
        hint={`Aquí vas a construir el plan desde el XLSForm y correr la auditoría con visualización completa. Estado actual: plan ${
          estado.plan_construido ? "construido" : "no construido"
        }, auditoría ${estado.auditoria_corrida ? "corrida" : "pendiente"}.`}
      />
    </div>
  );
}
