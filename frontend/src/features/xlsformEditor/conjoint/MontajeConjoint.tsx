// Montaje del panel «Experimento de elección por pares» en el editor (E7b; edición, C5 2026-11-07): para uno nuevo
// decide dónde entra (tras la pieza elegida, o al final); para el que ya tiene el formulario lo reemplaza en su lugar
// con sus mismos nombres. Deja elegida la primera fila. La página sólo le pasa el workbook y sus manejadores.

import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import type { BuilderSelection, BuilderStructure, XlsformEditorWorkbook } from "../types";
import { insertarConjoint, prefijoLibre, reemplazarConjoint } from "./insertarConjoint";
import { leerConjoint } from "./leerConjoint";
import type { DisenoConjoint } from "./modeloConjoint";
import { PANEL_EXPERIMENTO_CONJOINT, useModoPanelPares } from "./estadoPanelConjoint";
import { PanelConjoint } from "./PanelConjoint";

export function MontajeConjoint({ workbook, structure, selection, updateWorkbook, onInsertado }: {
  workbook: XlsformEditorWorkbook | null;
  structure: BuilderStructure | null;
  selection: BuilderSelection | null;
  updateWorkbook: (mutator: (draft: XlsformEditorWorkbook) => void) => void;
  onInsertado: (rowIndex: number) => void;
}) {
  const panel = usePanelDireccionable(PANEL_EXPERIMENTO_CONJOINT);
  const editar = useModoPanelPares((s) => s.editar);
  if (!workbook || !structure || !panel.abierto) return null;
  const lectura = editar ? leerConjoint(workbook) : null;
  const insertar = (d: DisenoConjoint): string[] => {
    const destino = selection?.kind === "survey"
      ? { despuesDeFila: selection.rowIndex, seccionFila: null }
      : { despuesDeFila: workbook.survey.rows.length - 1, seccionFila: null };
    let motivos: string[] = [];
    let fila = -1;
    updateWorkbook((draft) => {
      const r = lectura ? reemplazarConjoint(draft, lectura, d) : insertarConjoint(draft, structure, destino, d);
      if (r.ok) fila = r.rowIndex;
      else motivos = r.motivos;
    });
    if (fila >= 0) {
      panel.cerrar();
      onInsertado(fila);
    }
    return motivos;
  };
  return <PanelConjoint prefijoSugerido={prefijoLibre(workbook)} existente={lectura} onInsertar={insertar} />;
}
