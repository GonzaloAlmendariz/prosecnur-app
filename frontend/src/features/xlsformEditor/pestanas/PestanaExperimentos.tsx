// Pestaña Experimentos del editor (checklist elección por pares C8, 2026-11-07). A la izquierda, los experimentos que
// ya tiene el formulario y los que se pueden agregar; a la derecha, el diseño del elegido. Hoy hay un tipo, la elección
// por pares (conjoint); los demás se suman como entradas nuevas de `TIPOS`.

import { useMemo } from "react";
import { leerConjoint } from "../conjoint/leerConjoint";
import { insertarConjoint, prefijoLibre, reemplazarConjoint } from "../conjoint/insertarConjoint";
import type { DisenoConjoint } from "../conjoint/modeloConjoint";
import { DisenoPares } from "../conjoint/DisenoPares";
import { formatoConteo } from "../../../lib/formatoNumero";
import type { BuilderSelection, BuilderStructure, XlsformEditorWorkbook } from "../types";
import { PanelCard, ReadsAs } from "../kit";
import { PestanaReglas, type ReglaListaGrupo } from "./PestanaReglas";

/** Foco del experimento de elección por pares que ya está en el formulario. */
export const FOCO_PARES = "pares";
/** Foco para crear uno nuevo. */
export const FOCO_NUEVO_PARES = "nuevo:pares";

export function PestanaExperimentos({ workbook, structure, selection, updateWorkbook, seleccionada, onSeleccionar, onEditar }: {
  workbook: XlsformEditorWorkbook;
  structure: BuilderStructure | null;
  selection: BuilderSelection | null;
  updateWorkbook: (mutator: (draft: XlsformEditorWorkbook) => void) => void;
  seleccionada: string | null;
  onSeleccionar: (foco: string) => void;
  /** Lleva a una fila en el Constructor. */
  onEditar: (rowIndex: number) => void;
}) {
  const lectura = useMemo(() => leerConjoint(workbook), [workbook]);
  const foco = seleccionada === FOCO_NUEVO_PARES || (seleccionada === FOCO_PARES && lectura)
    ? seleccionada
    : lectura ? FOCO_PARES : FOCO_NUEVO_PARES;

  const grupos: ReglaListaGrupo[] = [
    {
      titulo: "En el formulario",
      items: lectura
        ? [{
            key: FOCO_PARES,
            baseType: "note",
            numero: "",
            titulo: "Elección por pares",
            resumen: `${formatoConteo(lectura.pares.length)} ${lectura.pares.length === 1 ? "par" : "pares"}, ${lectura.diseno.atributos.length} atributos`,
            aviso: !lectura.fiel,
          }]
        : [],
    },
    {
      titulo: "Agregar",
      items: [{
        key: FOCO_NUEVO_PARES,
        baseType: "note",
        numero: "",
        titulo: "Elección por pares",
        resumen: "Dos perfiles sorteados por par; se elige uno",
      }],
    },
  ];

  const aplicar = (d: DisenoConjoint): string[] => {
    if (!structure) return ["El formulario todavía no está listo."];
    const existente = foco === FOCO_PARES ? lectura : null;
    const destino = selection?.kind === "survey"
      ? { despuesDeFila: selection.rowIndex, seccionFila: null }
      : { despuesDeFila: workbook.survey.rows.length - 1, seccionFila: null };
    let motivos: string[] = [];
    let ok = false;
    updateWorkbook((draft) => {
      const r = existente ? reemplazarConjoint(draft, existente, d) : insertarConjoint(draft, structure, destino, d);
      if (r.ok) ok = true;
      else motivos = r.motivos;
    });
    if (ok && foco === FOCO_NUEVO_PARES) onSeleccionar(FOCO_PARES);
    return motivos;
  };

  const existente = foco === FOCO_PARES ? lectura : null;
  return (
    <PestanaReglas
      titulo="Experimentos"
      total={lectura ? "1 en el formulario" : "Ninguno en el formulario"}
      grupos={grupos}
      seleccionada={foco}
      onSeleccionar={onSeleccionar}
      vacio={null}
      vacioDetalle={
        <PanelCard title="Experimentos" fill flush>
          <ReadsAs label="Qué es">Un diseño que asigna al azar lo que ve cada encuestado para medir el efecto de lo que cambia.</ReadsAs>
        </PanelCard>
      }
    >
      <div className="xfp-encabezado">
        <span className="xfp-encabezado__ruta">{existente ? "Experimento" : "Experimento nuevo"}</span>
        <h2 className="xfp-encabezado__titulo">Elección por pares</h2>
        {existente ? (
          <span className="xfp-encabezado__accion">
            <button type="button" className="xfp-boton" onClick={() => onEditar(existente.pares[0]!.grupo)}>
              Ver en el Constructor
            </button>
          </span>
        ) : null}
      </div>
      <DisenoPares
        // Otro experimento u otra cantidad de pares: el diseño se vuelve a leer del formulario.
        key={existente ? `pares-${existente.pares.length}-${existente.filas.length}` : "nuevo"}
        prefijoSugerido={prefijoLibre(workbook)}
        existente={existente}
        onInsertar={aplicar}
      />
    </PestanaReglas>
  );
}
