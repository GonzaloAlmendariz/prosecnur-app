// "Cerrar y generar base" de Limpieza sobre el kit de entregables (ADR 0133,
// fase 5). El cierre aplica las decisiones, promueve la base (ADR 0076) y deja
// tres archivos: la base limpia, la revisión y las decisiones de limpieza. El
// kit no reúne varios archivos de una respuesta, así que el estado del
// contenedor se arma aquí (`estadoDelCierre`) y se refleja en la bandeja
// "Entregables" como cualquier otra generación.

import { useCallback, useRef, useState } from "react";
import { apiV2LimpiezaFinalize } from "../../../api/validacion";
import { useBandejaEntregables } from "../../../components/entregables/bandejaStore";
import { errorLegible } from "../../../components/entregables/generacionModelo";
import type { ArchivoEntregable, EstadoGeneracion } from "../../../components/entregables/tipos";
import { extractArtifacts } from "../limpiezaArtifacts";
import { MODULO_PROCESAMIENTO, archivosDelCierre, estadoDelCierre, type EntradaCierre } from "./modeloEntrega";

const INICIAL: EntradaCierre = { cerrando: false, error: "", archivos: null };

let secuencia = 0;

export type CierreLimpieza = {
  estado: EstadoGeneracion;
  cerrando: boolean;
  /** Cierra y genera la base; `true` si el cierre terminó bien. */
  finalizar: () => Promise<boolean>;
  cerrar: () => void;
};

export function useCierreLimpieza(baseNombre: string | null): CierreLimpieza {
  const [entrada, setEntrada] = useState<EntradaCierre>(INICIAL);
  const corriendo = useRef(false);

  const finalizar = useCallback(async (): Promise<boolean> => {
    if (corriendo.current) return false;
    corriendo.current = true;
    secuencia += 1;
    const id = `validacion-cierre-${Date.now().toString(36)}-${secuencia}`;
    const bandeja = useBandejaEntregables.getState();
    const enCurso: EntradaCierre = { cerrando: true, error: "", archivos: null };
    setEntrada(enCurso);
    const inicial = estadoDelCierre(enCurso);
    if (inicial.fase !== "inactiva") bandeja.registrar({ id, modulo: MODULO_PROCESAMIENTO, estado: inicial, inicio: Date.now() });
    let final: EntradaCierre;
    try {
      const out = await apiV2LimpiezaFinalize(baseNombre);
      const archivos: ArchivoEntregable[] = archivosDelCierre(extractArtifacts(out.artifacts)?.files);
      final = { cerrando: false, error: "", archivos };
    } catch (e) {
      final = { cerrando: false, error: errorLegible(e).causa, archivos: null };
    } finally {
      corriendo.current = false;
    }
    setEntrada(final);
    const estado = estadoDelCierre(final);
    if (estado.fase === "inactiva") useBandejaEntregables.getState().quitar(id);
    else useBandejaEntregables.getState().actualizar(id, estado);
    return !final.error;
  }, [baseNombre]);

  const cerrar = useCallback(() => setEntrada(INICIAL), []);

  return {
    estado: estadoDelCierre(entrada, () => { void finalizar(); }),
    cerrando: entrada.cerrando,
    finalizar,
    cerrar,
  };
}
