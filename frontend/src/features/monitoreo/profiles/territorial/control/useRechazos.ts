import { useCallback, useEffect, useState } from "react";
import type { MonitoreoTerritorialOperationalAdjustment, MonitoreoTerritorialPhase } from "../../../../../api/monitoreo";
import {
  getMonitoreoTerritorialRechazos,
  postMonitoreoTerritorialRechazar,
  type RechazoDeSubsanacion,
} from "../../../../../api/monitoreoRechazos";

/**
 * Rechazos auditados de la fase: se leen al montar y se reemplazan con lo que
 * devuelve el motor al rechazar, sin mutación optimista.
 */
export function useRechazos(phase: MonitoreoTerritorialPhase) {
  const [rechazos, setRechazos] = useState<RechazoDeSubsanacion[]>([]);

  useEffect(() => {
    let cancelado = false;
    getMonitoreoTerritorialRechazos(phase)
      .then((lista) => {
        if (!cancelado) setRechazos(lista);
      })
      .catch(() => {
        // Sin el historial de rechazos la pestaña sigue: solo no marca paquetes.
        if (!cancelado) setRechazos([]);
      });
    return () => {
      cancelado = true;
    };
  }, [phase]);

  const rechazar = useCallback(async (sugerencia: MonitoreoTerritorialOperationalAdjustment, nota: string) => {
    const lista = await postMonitoreoTerritorialRechazar({ sugerencia, nota, phase });
    setRechazos(lista);
    return lista;
  }, [phase]);

  return { rechazos, rechazar };
}
