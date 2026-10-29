import { useEffect, useState } from "react";

import { apiMaterialTerritorialEnvios, type EnviosPorFase } from "../../../api/materialTerritorial";

/** Qué fases tienen muestra enviada; se lee sólo mientras `activo` (el diálogo abierto con el tipo disponible). */
export function useEnviosTerritoriales(activo: boolean): { envios: EnviosPorFase | null; cargando: boolean; error: string } {
  const [envios, setEnvios] = useState<EnviosPorFase | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    setCargando(true);
    setError("");
    apiMaterialTerritorialEnvios()
      .then((r) => { if (vivo) setEnvios(r); })
      .catch((e: unknown) => { if (vivo) setError(e instanceof Error ? e.message : "No se pudo leer el envío de Hojas de ruta."); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [activo]);
  return { envios, cargando, error };
}
