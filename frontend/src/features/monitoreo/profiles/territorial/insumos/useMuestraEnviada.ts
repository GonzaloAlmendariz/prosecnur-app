import { useEffect, useState } from "react";
import { getMonitoreoTerritorialMuestraEnviada, type MuestraEnviada } from "../../../../../api/monitoreoMuestraEnviada";

/**
 * La muestra viva contra la enviada a Material (I4). `version` es la marca del
 * corte: al cambiar, se vuelve a pedir. Un error no tumba Conexiones: el aviso
 * simplemente no aparece.
 */
export function useMuestraEnviada(version = ""): MuestraEnviada | null {
  const [datos, setDatos] = useState<MuestraEnviada | null>(null);
  useEffect(() => {
    let cancelado = false;
    getMonitoreoTerritorialMuestraEnviada()
      .then((r) => { if (!cancelado) setDatos(r); })
      .catch(() => { if (!cancelado) setDatos(null); });
    return () => { cancelado = true; };
  }, [version]);
  return datos;
}
