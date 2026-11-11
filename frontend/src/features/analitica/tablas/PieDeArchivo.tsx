// La zona del archivo: el botón que lo genera y, a su lado, el avance, el
// archivo listo con sus acciones o el fallo. Queda bajo la mesa y no se
// desplaza con ella. La generación es la de `GenerateFooter` (PaneKit), sin
// cambios: aquí solo se le da el lugar.

import { Panel } from "../../../components/Panel";
import { FileSpreadsheet } from "../../../vendor/lucide-react";
import { GenerateFooter } from "../PaneKit";
import type { ReporteRunState } from "../useReporteRun";

export function PieDeArchivo({ rotulo, run, onGenerar, bloqueo }: {
  /** El rótulo del botón: "Generar frecuencias". */
  rotulo: string;
  run: Pick<ReporteRunState, "generacion" | "perBase">;
  onGenerar: () => void;
  /** Por qué no se puede generar todavía. Sin motivo, el botón está activo. */
  bloqueo?: string;
}) {
  return (
    <Panel
      noPadding
      className="tablas-panel tablas-archivo"
      title={<><FileSpreadsheet size={16} aria-hidden="true" /><span>Archivo</span></>}
    >
      <div className="tablas-archivo-cuerpo">
        <GenerateFooter
          label={rotulo}
          run={run}
          onGenerate={onGenerar}
          disabled={Boolean(bloqueo)}
          disabledHint={bloqueo}
        />
      </div>
    </Panel>
  );
}
