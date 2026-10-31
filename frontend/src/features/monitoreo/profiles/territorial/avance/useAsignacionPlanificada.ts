import { useEffect, useState } from "react";
import {
  getMonitoreoTerritorialAsignacionPlanificada,
  type AsignacionPlanificada,
} from "../../../../../api/monitoreoAsignacionPlanificada";

/**
 * La asignación de Material cruzada con lo observado (B3). `version` es la
 * marca del corte: al cambiar, se vuelve a pedir. Un error no tumba la tabla de
 * UMP: la columna simplemente no aparece.
 */
export function useAsignacionPlanificada(version = ""): AsignacionPlanificada | null {
  const [datos, setDatos] = useState<AsignacionPlanificada | null>(null);
  useEffect(() => {
    let cancelado = false;
    getMonitoreoTerritorialAsignacionPlanificada()
      .then((r) => { if (!cancelado) setDatos(r); })
      .catch(() => { if (!cancelado) setDatos(null); });
    return () => { cancelado = true; };
  }, [version]);
  return datos;
}
