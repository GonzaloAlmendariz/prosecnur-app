import { Info } from "lucide-react";

import { Alert } from "../../components/Alert";
import type { HojasRutaState } from "../../api/hojasRuta";
import { describirMarcoCartografia } from "./marcoCartografia";

/**
 * Qué cartografía usa el marco y cómo se compara con la oficial.
 *
 * Vive en archivo propio porque `HojasRutaPage.tsx` está congelado a
 * crecimiento: la funcionalidad nueva se cuelga de un componente que la página
 * llama, no de más líneas dentro del monolito.
 *
 * El marco piloto conserva su banda ámbar —ya avisaba y sigue avisando—; el
 * resto de los proyectos, que son los que nunca vieron nada, reciben un chip
 * informativo que no se descarta: la procedencia del marco es una propiedad
 * suya, no una notificación.
 */
export default function MarcoCartografiaAviso({
  frame,
}: {
  frame: HojasRutaState["frame_meta"] | null | undefined;
}) {
  const marco = describirMarcoCartografia(frame);
  if (!marco) return null;
  if (marco.piloto) return <Alert kind="warn">{marco.detalle}</Alert>;
  return (
    <div className="hojas-ruta-marco-chip" role="status" title={marco.detalle}>
      <Info size={13} aria-hidden="true" />
      <span data-audit-marco-cartografia>{marco.resumen}</span>
    </div>
  );
}
