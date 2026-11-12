/**
 * Pestaña Explorar de Validación (ADR 0142, rebanada V2 de P6; cabecera en V5).
 *
 * La cabecera la monta `ExplorarTab`, que es quien sabe sus cifras (preguntas,
 * casos, cruce y filtros) y lleva la versión de la base (Cargada / Limpia).
 * Sin envoltorio, porque la hoja de la página reconoce a Explorar como hijo
 * directo del cuerpo (`.pulso-validacion-panel-body:has(>
 * .pulso-validacion-explorar-layout)`) y con eso le da el alto completo. La
 * readiness la publica `ExplorarTab`.
 */
import type { ProcessingSheetRepeatContext } from "../../../lib/rosterExplorer";
import ExplorarTab from "../tabs/ExplorarTab";

export default function PestanaExplorar({ repeat }: { repeat: ProcessingSheetRepeatContext | null }) {
  return <ExplorarTab repeat={repeat} />;
}
