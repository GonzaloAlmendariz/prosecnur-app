// Pestaña Experimentos del editor (checklist elección por pares C8 y C10, 2026-11-07). A la izquierda, los experimentos
// que ya tiene el formulario y los que se pueden agregar; a la derecha, el diseño del elegido. Hay cinco tipos:
// elección por pares (conjoint), viñetas (encuesta factorial), versiones al azar (split-sample, C12), lista (técnica
// de conteo de ítems, C14) y respaldo (endorsement, C15).

import { useMemo } from "react";
import { leerConjoint } from "../conjoint/leerConjoint";
import { insertarConjoint, insertarLista, insertarRespaldo, insertarVersiones, insertarVinetas, listasDe, prefijoLibre, reemplazarConjoint, reemplazarLista, reemplazarRespaldo, reemplazarVersiones, reemplazarVinetas } from "../conjoint/insertarConjoint";
import { leerRespaldo } from "../conjoint/leerRespaldo";
import type { DisenoRespaldo } from "../conjoint/modeloRespaldo";
import { DisenoRespaldo as DisenoRespaldoPanel } from "../conjoint/DisenoRespaldo";
import { leerLista } from "../conjoint/leerLista";
import type { DisenoLista } from "../conjoint/modeloLista";
import { DisenoLista as DisenoListaPanel } from "../conjoint/DisenoLista";
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
export const FOCO_NUEVO_LISTA = "nuevo:lista";
/** Foco de un experimento de lista: puede haber varios, se distinguen por su prefijo. */
export const focoLista = (prefijo: string) => `lista:${prefijo}`;
export const FOCO_NUEVO_RESPALDO = "nuevo:respaldo";
/** Foco de un experimento de respaldo: puede haber varios, se distinguen por su prefijo. */
export const focoRespaldo = (prefijo: string) => `respaldo:${prefijo}`;

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
  const lecturasLs = useMemo(() => leerLista(workbook), [workbook]);
  const lecturasRs = useMemo(() => leerRespaldo(workbook), [workbook]);
  const listas = useMemo(() => listasDe(workbook), [workbook]);
  const validos = [
    FOCO_NUEVO_PARES, FOCO_NUEVO_VINETAS, FOCO_NUEVO_VERSIONES, FOCO_NUEVO_LISTA, FOCO_NUEVO_RESPALDO,
    ...(lectura ? [FOCO_PARES] : []), ...(lecturaV ? [FOCO_VINETAS] : []),
    ...lecturasVs.map((l) => focoVersiones(l.diseno.pregunta)),
    ...lecturasLs.map((l) => focoLista(l.diseno.prefijo)),
    ...lecturasRs.map((l) => focoRespaldo(l.diseno.prefijo)),
  ];
  const foco = seleccionada && validos.includes(seleccionada)
    ? seleccionada
    : lectura ? FOCO_PARES : lecturaV ? FOCO_VINETAS : lecturasVs[0] ? focoVersiones(lecturasVs[0].diseno.pregunta) : lecturasLs[0] ? focoLista(lecturasLs[0].diseno.prefijo) : lecturasRs[0] ? focoRespaldo(lecturasRs[0].diseno.prefijo) : FOCO_NUEVO_PARES;
  const cuantos = (lectura ? 1 : 0) + (lecturaV ? 1 : 0) + lecturasVs.length + lecturasLs.length + lecturasRs.length;

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
        ...lecturasLs.map((l) => ({
          key: focoLista(l.diseno.prefijo),
          baseType: "note",
          numero: "",
          titulo: "Lista",
          resumen: `${l.diseno.controles.length} afirmaciones y 1 sensible`,
          aviso: !l.fiel,
        })),
        ...lecturasRs.map((l) => ({
          key: focoRespaldo(l.diseno.prefijo),
          baseType: "note",
          numero: "",
          titulo: "Respaldo",
          resumen: `${l.diseno.politicas.length} ${l.diseno.politicas.length === 1 ? "política" : "políticas"}, ${l.diseno.actores.length} ${l.diseno.actores.length === 1 ? "actor" : "actores"}`,
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
      }, {
        key: FOCO_NUEVO_LISTA,
        baseType: "note",
        numero: "",
        titulo: "Lista",
        resumen: "Cuántas afirmaciones son ciertas, con y sin una sensible",
      }, {
        key: FOCO_NUEVO_RESPALDO,
        baseType: "note",
        numero: "",
        titulo: "Respaldo",
        resumen: "Las mismas políticas, con o sin el apoyo de un actor",
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
  const lecturaLs = lecturasLs.find((l) => focoLista(l.diseno.prefijo) === foco) ?? null;
  const aplicarLista = (d: DisenoLista): string[] => {
    if (!structure) return ["El formulario todavía no está listo."];
    const existente = lecturaLs;
    return escribir((draft) => (existente ? reemplazarLista(draft, existente, d) : insertarLista(draft, structure, destino, d)), focoLista(d.prefijo));
  };
  const esLista = foco === FOCO_NUEVO_LISTA || Boolean(lecturaLs);
  const lecturaRs = lecturasRs.find((l) => focoRespaldo(l.diseno.prefijo) === foco) ?? null;
  const aplicarRespaldo = (d: DisenoRespaldo): string[] => {
    if (!structure) return ["El formulario todavía no está listo."];
    const existente = lecturaRs;
    return escribir((draft) => (existente ? reemplazarRespaldo(draft, existente, d) : insertarRespaldo(draft, structure, destino, d)), focoRespaldo(d.prefijo));
  };
  const esRespaldo = foco === FOCO_NUEVO_RESPALDO || Boolean(lecturaRs);
  const esVinetas = foco === FOCO_VINETAS || foco === FOCO_NUEVO_VINETAS;
  const existente = foco === FOCO_PARES ? lectura : null;
  const existenteV = foco === FOCO_VINETAS ? lecturaV : null;
  const primeraFila = existente ? existente.pares[0]!.grupo : existenteV ? existenteV.vinetas[0]!.grupo : lecturaVs ? lecturaVs.pregunta : lecturaLs ? lecturaLs.conteo : lecturaRs ? lecturaRs.sorteo[0]! : null;
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
        <h2 className="xfp-encabezado__titulo">{esRespaldo ? "Respaldo" : esLista ? "Lista" : esVersiones ? "Versiones al azar" : esVinetas ? "Viñetas" : "Elección por pares"}</h2>
        {primeraFila != null ? (
          <span className="xfp-encabezado__accion">
            <button type="button" className="xfp-boton" onClick={() => onEditar(primeraFila)}>
              Ver en el Constructor
            </button>
          </span>
        ) : null}
      </div>
      {esRespaldo ? (
        <DisenoRespaldoPanel
          key={lecturaRs ? `respaldo-${lecturaRs.diseno.prefijo}-${lecturaRs.diseno.politicas.length}-${lecturaRs.diseno.actores.length}` : "nuevo-respaldo"}
          prefijoSugerido={prefijoLibre(workbook, "rs")}
          existente={lecturaRs}
          onInsertar={aplicarRespaldo}
        />
      ) : esLista ? (
        <DisenoListaPanel
          key={lecturaLs ? `lista-${lecturaLs.diseno.prefijo}-${lecturaLs.diseno.controles.length}` : "nuevo-lista"}
          prefijoSugerido={prefijoLibre(workbook, "ls")}
          existente={lecturaLs}
          onInsertar={aplicarLista}
        />
      ) : esVersiones ? (
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
