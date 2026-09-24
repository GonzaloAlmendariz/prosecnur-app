/**
 * «Probar reemplazos»: simula la cadena de reemplazos sobre la selección
 * vigente. Vive en la barra de Selección y, en la pestaña Reemplazos, dentro
 * del bloque cuyo resultado re-ejecuta (AD8-E15) — antes ocupaba ahí una
 * tarjeta propia que no contenía nada más.
 */
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../api/client";
import { Loader2, RefreshCw } from "../../../../vendor/lucide-react";

export const BUSY_SIMULANDO_REEMPLAZOS = "Simulando reemplazos";

export function ProbarReemplazosBoton({
  config,
  busy,
  selectionReady,
  onSimulateReplacements,
}: {
  config: CalcMuestraWorkspaceAulasConfig;
  busy: string | null;
  selectionReady: boolean;
  onSimulateReplacements: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      className="cmv2-ghost"
      onClick={() => void onSimulateReplacements(config)}
      disabled={Boolean(busy) || !selectionReady}
    >
      {busy === BUSY_SIMULANDO_REEMPLAZOS ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
      Probar reemplazos
    </button>
  );
}
