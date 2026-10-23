import { useEffect, useState } from "react";
import { getMonitoreoTerritorialCasosUmp, type CasosDeUmp } from "../../../../../api/monitoreoCasosUmp";

export type EstadoDeCasosDeUmp =
  | { tipo: "sin-ump" }
  | { tipo: "cargando"; ump: string }
  | { tipo: "listo"; ump: string; datos: CasosDeUmp }
  | { tipo: "error"; ump: string; mensaje: string };

/**
 * Casos de una UMP con GPS y hora (incluidos los anulados). `version` es la
 * marca del corte (`synced_at`): al cambiar, se vuelven a pedir.
 */
export function useCasosDeUmp(ump: string | null, version = ""): EstadoDeCasosDeUmp {
  const [estado, setEstado] = useState<EstadoDeCasosDeUmp>(ump ? { tipo: "cargando", ump } : { tipo: "sin-ump" });

  useEffect(() => {
    if (!ump) {
      setEstado({ tipo: "sin-ump" });
      return undefined;
    }
    let cancelado = false;
    setEstado({ tipo: "cargando", ump });
    getMonitoreoTerritorialCasosUmp(ump)
      .then((datos) => {
        if (!cancelado) setEstado({ tipo: "listo", ump, datos });
      })
      .catch((error: unknown) => {
        if (!cancelado) setEstado({ tipo: "error", ump, mensaje: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      cancelado = true;
    };
  }, [ump, version]);

  return estado;
}
