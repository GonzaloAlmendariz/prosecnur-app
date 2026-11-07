// Pestaña Experimentos del editor (checklist elección por pares C8 y C10, 2026-11-07). A la izquierda, los experimentos
// que ya tiene el formulario y los que se pueden agregar; a la derecha, el diseño del elegido. Hay tres tipos: elección
// por pares (conjoint), viñetas (encuesta factorial) y versiones al azar (split-sample, C12).

import { useMemo } from "react";
import { leerConjoint } from "../conjoint/leerConjoint";
import { insertarConjoint, insertarVersiones, insertarVinetas, listasDe, prefijoLibre, reemplazarConjoint, reemplazarVersiones, reemplazarVinetas } from "../conjoint/insertarConjoint";
import { leerVersiones } from "../conjoint/leerVersiones";
import type { DisenoVersiones } from "../conjoint/modeloVersiones";
import { DisenoVersiones as DisenoVersionesPanel } from "../conjoint/DisenoVersiones";
import { leerVinetas } from "../conjoint/leerVinetas";
import type { DisenoVinetas } from "../conjoint/modeloVinetas";
import { DisenoVinetas as DisenoVinetasPanel } from "../conjoint/DisenoVinetas";
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
export const FOCO_VINETAS = "vinetas";
export const FOCO_NUEVO_VINETAS = "nuevo:vinetas";
export const FOCO_NUEVO_VERSIONES = "nuevo:versiones";
/** Foco de una pregunta con versiones al azar: puede haber varias, se distinguen por su código. */
export const focoVersiones = (pregunta: string) => `versiones:${pregunta}`;

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
  const lecturaV = useMemo(() => leerVinetas(workbook), [workbook]);
  const lecturasVs = useMemo(() => leerVersiones(workbook), [workbook]);
  const listas = useMemo(() => listasDe(workbook), [workbook]);
  const validos = [
    FOCO_NUEVO_PARES, FOCO_NUEVO_VINETAS, FOCO_NUEVO_VERSIONES,
    ...(lectura ? [FOCO_PARES] : []), ...(lecturaV ? [FOCO_VINETAS] : []),
    ...lecturasVs.map((l) => focoVersiones(l.diseno.pregunta)),
  ];
  const foco = seleccionada && validos.includes(seleccionada)
    ? seleccionada
    : lectura ? FOCO_PARES : lecturaV ? FOCO_VINETAS : lecturasVs[0] ? focoVersiones(lecturasVs[0].diseno.pregunta) : FOCO_NUEVO_PARES;
  const cuantos = (lectura ? 1 : 0) + (lecturaV ? 1 : 0) + lecturasVs.length;

  const grupos: ReglaListaGrupo[] = [
    {
      titulo: "En el formulario",
      items: [
        ...(lectura
          ? [{
              key: FOCO_PARES,
              baseType: "note",
              numero: "",
              titulo: "Elección por pares",
              resumen: `${formatoConteo(lectura.pares.length)} ${lectura.pares.length === 1 ? "par" : "pares"}, ${lectura.diseno.atributos.length} atributos`,
              aviso: !lectura.fiel,
            }]
          : []),
        ...(lecturaV
          ? [{
              key: FOCO_VINETAS,
              baseType: "note",
              numero: "",
              titulo: "Viñetas",
              resumen: `${formatoConteo(lecturaV.vinetas.length)} ${lecturaV.vinetas.length === 1 ? "viñeta" : "viñetas"}, ${lecturaV.diseno.atributos.length} atributos`,
              aviso: !lecturaV.fiel,
            }]
          : []),
        ...lecturasVs.map((l) => ({
          key: focoVersiones(l.diseno.pregunta),
          baseType: "note",
          numero: "",
          titulo: "Versiones al azar",
          resumen: `${l.diseno.pregunta}: ${l.diseno.versiones.length} versiones`,
          aviso: !l.fiel,
        })),
      ],
    },
    {
      titulo: "Agregar",
      items: [{
        key: FOCO_NUEVO_PARES,
        baseType: "note",
        numero: "",
        titulo: "Elección por pares",
        resumen: "Dos perfiles sorteados por par; se elige uno",
      }, {
        key: FOCO_NUEVO_VINETAS,
        baseType: "note",
        numero: "",
        titulo: "Viñetas",
        resumen: "Un escenario con atributos sorteados; se califica",
      }, {
        key: FOCO_NUEVO_VERSIONES,
        baseType: "note",
        numero: "",
        titulo: "Versiones al azar",
        resumen: "Una pregunta en varias redacciones; a cada uno le toca una",
      }],
    },
  ];

  const destino = selection?.kind === "survey"
    ? { despuesDeFila: selection.rowIndex, seccionFila: null }
    : { despuesDeFila: workbook.survey.rows.length - 1, seccionFila: null };
  /** Aplica una escritura al formulario; si crea uno nuevo, queda elegido. */
  const escribir = (hacer: (draft: XlsformEditorWorkbook) => { ok: true } | { ok: false; motivos: string[] }, alCrear: string | null): string[] => {
    let motivos: string[] = [];
    let ok = false;
    updateWorkbook((draft) => {
      const r = hacer(draft);
      if (r.ok) ok = true;
      else motivos = r.motivos;
    });
    if (ok && alCrear) onSeleccionar(alCrear);
    return motivos;
  };
  const aplicar = (d: DisenoConjoint): string[] => {
    if (!structure) return ["El formulario todavía no está listo."];
    const existente = foco === FOCO_PARES ? lectura : null;
    return escribir((draft) => (existente ? reemplazarConjoint(draft, existente, d) : insertarConjoint(draft, structure, destino, d)), existente ? null : FOCO_PARES);
  };
  const aplicarVinetas = (d: DisenoVinetas): string[] => {
    if (!structure) return ["El formulario todavía no está listo."];
    const existente = foco === FOCO_VINETAS ? lecturaV : null;
    return escribir((draft) => (existente ? reemplazarVinetas(draft, existente, d) : insertarVinetas(draft, structure, destino, d)), existente ? null : FOCO_VINETAS);
  };

  const lecturaVs = lecturasVs.find((l) => focoVersiones(l.diseno.pregunta) === foco) ?? null;
  const aplicarVersiones = (d: DisenoVersiones): string[] => {
    if (!structure) return ["El formulario todavía no está listo."];
    const existente = lecturaVs;
    return escribir((draft) => (existente ? reemplazarVersiones(draft, existente, d) : insertarVersiones(draft, structure, destino, d)), focoVersiones(d.pregunta));
  };
  const esVersiones = foco === FOCO_NUEVO_VERSIONES || Boolean(lecturaVs);
  const esVinetas = foco === FOCO_VINETAS || foco === FOCO_NUEVO_VINETAS;
  const existente = foco === FOCO_PARES ? lectura : null;
  const existenteV = foco === FOCO_VINETAS ? lecturaV : null;
  const primeraFila = existente ? existente.pares[0]!.grupo : existenteV ? existenteV.vinetas[0]!.grupo : lecturaVs ? lecturaVs.pregunta : null;
  return (
    <PestanaReglas
      titulo="Experimentos"
      total={cuantos ? `${cuantos} en el formulario` : "Ninguno en el formulario"}
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
        <span className="xfp-encabezado__ruta">{primeraFila != null ? "Experimento" : "Experimento nuevo"}</span>
        <h2 className="xfp-encabezado__titulo">{esVersiones ? "Versiones al azar" : esVinetas ? "Viñetas" : "Elección por pares"}</h2>
        {primeraFila != null ? (
          <span className="xfp-encabezado__accion">
            <button type="button" className="xfp-boton" onClick={() => onEditar(primeraFila)}>
              Ver en el Constructor
            </button>
          </span>
        ) : null}
      </div>
      {esVersiones ? (
        <DisenoVersionesPanel
          key={lecturaVs ? `versiones-${lecturaVs.diseno.pregunta}-${lecturaVs.diseno.versiones.length}` : "nuevo-versiones"}
          prefijoSugerido={prefijoLibre(workbook, "vs")}
          listas={listas}
          existente={lecturaVs}
          onInsertar={aplicarVersiones}
        />
      ) : esVinetas ? (
        <DisenoVinetasPanel
          key={existenteV ? `vinetas-${existenteV.vinetas.length}-${existenteV.filas.length}` : "nuevo-vinetas"}
          prefijoSugerido={prefijoLibre(workbook, "vi")}
          existente={existenteV}
          onInsertar={aplicarVinetas}
        />
      ) : (
        <DisenoPares
          // Otro experimento u otra cantidad de pares: el diseño se vuelve a leer del formulario.
          key={existente ? `pares-${existente.pares.length}-${existente.filas.length}` : "nuevo"}
          prefijoSugerido={prefijoLibre(workbook)}
          existente={existente}
          onInsertar={aplicar}
        />
      )}
    </PestanaReglas>
  );
}
