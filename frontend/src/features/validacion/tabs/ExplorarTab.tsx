import { useEffect, useState } from "react";
import { AlertTriangle, Compass } from "lucide-react";
import { apiV2ExplorarVariables } from "../../../api/client";
import type { ExploradorVariablesList } from "../types";
import { useValidacionStore } from "../store";
import { LoadingBlock, EmptyState } from "../../../components/States";

// =============================================================================
// Explorar — explorador de variables con gráficos automáticos
// =============================================================================
// Sprint 1: stub. Sprint 3 implementa:
//   - Panel izquierdo: lista de variables agrupadas por sección.
//   - Panel derecho: al seleccionar, backend detecta tipo (SO/SM/num/
//     fecha/texto) y devuelve KPI + distribución + outliers.
//   - Cruce opcional con segunda variable (bivariado).

export default function ExplorarTab() {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const prefillExp = useValidacionStore((s) => s.prefill.explorar);
  const clearPrefill = useValidacionStore((s) => s.clearPrefill);
  const [data, setData] = useState<ExploradorVariablesList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    apiV2ExplorarVariables(baseNombre)
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
    if (prefillExp?.var) {
      // Sprint 3: abrir automáticamente esa variable.
      // eslint-disable-next-line no-console
      console.log("ExplorarTab prefill:", prefillExp);
      clearPrefill("explorar");
    }
  }, [prefillExp, clearPrefill]);

  if (loading) return <LoadingBlock label="Cargando variables…" />;
  if (error)
    return (
      <EmptyState icon={<AlertTriangle size={20} />} title="Error" hint={error} />
    );
  if (!data) return null;

  return (
    <EmptyState
      icon={<Compass size={20} />}
      title="Explorador de variables — pendiente Sprint 3"
      hint={`Aquí vas a navegar las ${data.n_variables} variables de esta base y ver su distribución con gráficos automáticos.`}
    />
  );
}
