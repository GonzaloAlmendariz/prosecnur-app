// Montaje del panel «Experimento conjoint» en el editor (E7b): decide dónde entra el bloque (tras la pieza elegida,
// o al final), lo inserta y deja elegida su primera fila. La página sólo le pasa el workbook y sus manejadores.

import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import type { BuilderSelection, BuilderStructure, XlsformEditorWorkbook } from "../types";
import { insertarConjoint, prefijoLibre } from "./insertarConjoint";
import type { DisenoConjoint } from "./modeloConjoint";
import { PANEL_EXPERIMENTO_CONJOINT } from "./estadoPanelConjoint";
import { PanelConjoint } from "./PanelConjoint";

export function MontajeConjoint({ workbook, structure, selection, updateWorkbook, onInsertado }: {
  workbook: XlsformEditorWorkbook | null;
  structure: BuilderStructure | null;
  selection: BuilderSelection | null;
  updateWorkbook: (mutator: (draft: XlsformEditorWorkbook) => void) => void;
  onInsertado: (rowIndex: number) => void;
}) {
  const panel = usePanelDireccionable(PANEL_EXPERIMENTO_CONJOINT);
  if (!workbook || !structure || !panel.abierto) return null;
  const insertar = (d: DisenoConjoint): string[] => {
    const destino = selection?.kind === "survey"
      ? { despuesDeFila: selection.rowIndex, seccionFila: null }
      : { despuesDeFila: workbook.survey.rows.length - 1, seccionFila: null };
    let motivos: string[] = [];
    let fila = -1;
    updateWorkbook((draft) => {
      const r = insertarConjoint(draft, structure, destino, d);
      if (r.ok) fila = r.rowIndex;
      else motivos = r.motivos;
    });
    if (fila >= 0) {
      panel.cerrar();
      onInsertado(fila);
    }
    return motivos;
  };
  return <PanelConjoint prefijoSugerido={prefijoLibre(workbook)} onInsertar={insertar} />;
}
