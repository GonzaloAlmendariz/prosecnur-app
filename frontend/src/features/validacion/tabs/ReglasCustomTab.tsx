import { useEffect, useState } from "react";
import { AlertTriangle, PieChart } from "lucide-react";
import { apiV2ReglasCustomList } from "../../../api/client";
import type { ReglasCustomList } from "../types";
import { useValidacionStore } from "../store";
import { LoadingBlock, EmptyState } from "../../../components/States";

// =============================================================================
// Reglas personalizadas — editor visual de reglas custom
// =============================================================================
// Sprint 1: stub. Sprint 4 implementa el wizard de 3 pasos (tipo →
// variables → parámetros) + lista con editar/eliminar/activar + botón
// "Ejecutar reglas" que corre contra la base y suma a la auditoría.

export default function ReglasCustomTab() {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const prefill = useValidacionStore((s) => s.prefill.reglas_custom);
  const clearPrefill = useValidacionStore((s) => s.clearPrefill);
  const [data, setData] = useState<ReglasCustomList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    apiV2ReglasCustomList(baseNombre)
      .then((d) => {
        if (!cancel) setData(d);
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

  useEffect(() => {
    if (prefill) {
      // eslint-disable-next-line no-console
      console.log("ReglasCustomTab prefill:", prefill);
      clearPrefill("reglas_custom");
    }
  }, [prefill, clearPrefill]);

  if (loading) return <LoadingBlock label="Cargando reglas…" />;
  if (error)
    return (
      <EmptyState icon={<AlertTriangle size={20} />} title="Error" hint={error} />
    );
  if (!data) return null;

  return (
    <EmptyState
      icon={<PieChart size={20} />}
      title="Reglas personalizadas — pendiente Sprint 4"
      hint={`Aquí vas a definir reglas finas (rangos, outliers, duplicados, coherencia entre 2 variables, etc.) sin tocar Excel. Actualmente hay ${data.reglas.length} reglas en esta base.`}
    />
  );
}
