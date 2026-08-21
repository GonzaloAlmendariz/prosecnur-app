/**
 * Pestaña «Solidez de la selección» (id solidez) de la sección Aulas.
 *
 * Nace de partir «Cursos-horario titulares» en dos — Gonzalo (2026-08-20):
 * «esta pestaña sigue viéndose fatal y tiene muchísima información que podría
 * ser separada en dos pestañas». La de titulares se queda con lo OPERATIVO
 * (qué se seleccionó y si alcanza); ésta responde POR QUÉ estas aulas y qué
 * tan sólida es la selección: la aritmética del esperado, el margen del
 * pedido, las comparaciones, el aporte, los solapes y el ajuste al marco.
 */
import type {
  CalcMuestraAulasEstrato,
  CalcMuestraReferenciaAsistencia,
  CalcMuestraSexoPorFacultad,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { MargenPorFacultadCard } from "./MargenPorFacultadCard";
import { EfectividadExplicadaCard } from "./EfectividadExplicadaCard";
import { SustentoDimensionamientoCard } from "./SustentoDimensionamientoCard";
import { SexoPorFacultadCard } from "./SexoPorFacultadCard";
import { EmbudoComparadoFacultades } from "../salidas/EmbudoComparadoFacultades";
import type { FichaFacultad } from "../criterios/fichaFacultadModel";
import { SeleccionAulasVisual } from "../../didactica/SeleccionAulasVisual";
import { AporteTitularesCard } from "./AporteTitularesCard";
import { DocenteUnicoAviso } from "./DocenteUnicoAviso";
import { DescuentoRepetidosPanel } from "./DescuentoRepetidosPanel";
import {
  ClassroomOverlapGraph,
  ClassroomSelectionRationaleDashboard,
  CoverageOverlapPanel,
  ProfileBalanceChart,
  type ClassroomLabModel,
} from "./aulasParts";
import "../../didactica/didactica.css";
import "./aulas.css";

export function AulasSolidezTab({
  workspace,
  model,
  margenFilas = null,
  sexoBalance = null,
  fichas = null,
  periodoAnterior = "",
  referencia = null,
}: {
  workspace: CalcMuestraWorkspace;
  model: ClassroomLabModel;
  /** Filas de `aulas_por_estrato` con su bloque `margen`. */
  margenFilas?: CalcMuestraAulasEstrato[] | null;
  /** Balance de sexo por facultad de la selección vigente. */
  sexoBalance?: CalcMuestraSexoPorFacultad | null;
  /** Fichas hoy/antes por facultad para el embudo comparado. */
  fichas?: FichaFacultad[] | null;
  periodoAnterior?: string;
  /** El estudio anterior, para la lectura REFERENCIAL del τ propio. */
  referencia?: CalcMuestraReferenciaAsistencia | null;
}) {
  const {
    selection,
    selectionReady,
    selectionRows,
    coverageRows,
    visibleProfiles,
    m1Rows,
    framePopulationCount,
    targetForDisplay,
  } = model;

  // C3: la pestaña contiene su propio vacío — sin selección corrida, el
  // sustento no existe todavía y se dice por qué.
  if (!selectionReady) {
    return (
      <div className="cmv2-aulas-stack">
        <section className="cmv2-panel cmv2-aulas-panel">
          <div className="cmv2-subhead">
            <strong>Solidez de la selección</strong>
          </div>
          <p className="cmv2-aulas-vacio-nota">
            Todavía no hay una selección corrida: el sustento se construye sobre
            ella. Corre la selección en «Cursos-horario titulares» y esta
            pestaña mostrará por qué salieron esas aulas y qué tan sólida es la
            muestra que arman.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="cmv2-aulas-stack">
      {/* P5 · Los cinco actos del sustento, con el kicker del recorrido de
          Cursos-horario requeridos: la estructura que vivía en comentarios
          pasa a la vista del lector. */}
      <div className="cmv2-solidez-acto" data-acto="1">
        <span className="cmv2-solidez-kicker">Paso 1 · Qué promete cada aula: la radiografía del esperado</span>
        <EfectividadExplicadaCard filas={selectionRows} titulares={m1Rows} />
        <DocenteUnicoAviso registro={selection?.diagnostics?.docente_unico} />
      </div>

      <div className="cmv2-solidez-acto" data-acto="2">
        <span className="cmv2-solidez-kicker">Paso 2 · Qué se pidió: el margen y el sustento del dimensionamiento</span>
        <MargenPorFacultadCard filas={margenFilas} />
        <SustentoDimensionamientoCard filas={margenFilas} referencia={referencia ?? null} />
      </div>

      <div className="cmv2-solidez-acto" data-acto="3">
        <span className="cmv2-solidez-kicker">Paso 3 · Contra qué se compara: el estudio anterior y el balance de sexo</span>
        {fichas && fichas.length ? (
          <EmbudoComparadoFacultades fichas={fichas} periodo={periodoAnterior} pasoInicial={7} />
        ) : null}
        <SexoPorFacultadCard balance={sexoBalance} />
      </div>

      <div className="cmv2-solidez-acto" data-acto="4">
        <span className="cmv2-solidez-kicker">Paso 4 · Cómo se sorteó: la mecánica y el aporte de cada titular</span>
        {/* El visual lee tokens del DOM al montar: solo existe con selección real. */}
        {selection ? (
          <SeleccionAulasVisual
            seleccion={selection}
            nObjetivo={targetForDisplay || null}
            totalFacultades={model.facultades.length || null}
          />
        ) : null}
        <AporteTitularesCard filas={m1Rows} />
      </div>

      <div className="cmv2-solidez-acto" data-acto="5">
        <span className="cmv2-solidez-kicker">Paso 5 · Qué tan limpia es: solapes, repetidos y ajuste al marco</span>
      <div className="cmv2-classroom-lab-grid">
        <div className="cmv2-classroom-lab-main">
          <div className="cmv2-subhead">
            <strong>Cobertura y solape</strong>
          </div>
          <CoverageOverlapPanel rows={coverageRows} selectionRows={m1Rows} framePopulation={framePopulationCount} />
          <DescuentoRepetidosPanel selection={selection} m1Rows={m1Rows} />
          <ClassroomSelectionRationaleDashboard rows={m1Rows} workspace={workspace} />
          <div className="cmv2-subhead">
            <strong>Ajuste frente al marco</strong>
          </div>
          <ProfileBalanceChart rows={visibleProfiles} />
        </div>
        <aside className="cmv2-classroom-lab-side">
          <ClassroomOverlapGraph rows={m1Rows} />
        </aside>
      </div>
      </div>
    </div>
  );
}
