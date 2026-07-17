/**
 * Aviso de resultado no aplicado por marco desactualizado. El backend (F4)
 * guarda aparte el resultado de un job cuyo frame_hash ya no corresponde al
 * marco vigente (`state.aulas.stale_job_result`) en vez de pisar la mesa
 * buena; este banner lo hace visible donde viven las acciones de la mesa y
 * pide re-ejecutar. No bloquea nada: la selección/comparación vigentes siguen
 * siendo válidas para su marco. Usa el aviso unificado del módulo (QA H7).
 */
import { AvisoModulo } from "../shared/AvisoModulo";
import type { StaleJobAviso } from "./descuentoRepetidosModel";

export function AulasStaleJobAviso({ aviso }: { aviso: StaleJobAviso | null }) {
  if (!aviso) return null;
  return (
    <AvisoModulo tone="warn" title={`El resultado del job «${aviso.kindLabel}» no se aplicó.`}>
      El marco cambió mientras corría, así que su resultado quedó descartado para no pisar la mesa
      vigente. Vuelve a ejecutarlo sobre el marco actual.
      {aviso.jobId ? ` (job ${aviso.jobId})` : ""}
    </AvisoModulo>
  );
}
