/**
 * Pestaña "Simulación" (id laboratorio) de la sección Aulas. Responde "¿el
 * resultado es estable o depende de una corrida?": resumen de corridas por
 * método y métricas del recomendado (conservados), un bloque nuevo de
 * estabilidad de pesos (micro-barra n_eff vs n nominal + fórmula del n
 * efectivo — aquí se explica por ÚNICA vez la ponderación w_i = 1/π_i — y
 * cifras del motor) y el histograma de frecuencia de selección por aula entre
 * corridas (π Monte Carlo) cuando el motor lo trae.
 */
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../api/client";
import { fmtDec, fmtInt, fmtPct, rowsFrom, safeNumber } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import { saludComoRiesgos, saludDesdeModel } from "../shared/salud";
import { CifraFila, CifraMotor, FormulaLatex, TerminoChip } from "../ui";
import {
  ClassroomLabCommandBar,
  ClassroomRecommendation,
  RepresentativityMetricGrid,
  SimulationSummaryPanel,
  type ClassroomLabModel,
} from "./aulasParts";
import {
  AulasStageNotice,
  hasAulasSimulationEvidence,
  resolveAulasStageNotice,
  type AulasNavigate,
} from "./aulasSurfaceState";
import { ClassroomRiskList } from "./ClassroomRiskList";
import "../../didactica/didactica.css";
import "./aulas.css";

/** Estabilidad de pesos: micro-barra n_eff vs n nominal + fórmula + cifras. */
function WeightStabilityBlock({ model }: { model: ClassroomLabModel }) {
  const row = model.weightStability;
  if (!row) return null;
  const cv = classroomRowNumber(row, ["cv"]);
  const nEff = classroomRowNumber(row, ["n_eff"]);
  const ratio = classroomRowNumber(row, ["n_eff_ratio"]);
  const score = classroomRowNumber(row, ["score"]);
  const detail = classroomRowText(row, ["detail"]);
  const nNominal = ratio > 0 ? Math.round(nEff / ratio) : model.m1Rows.length;
  const cvWarn = safeNumber(model.objective.weight_cv_warn, 0.5);
  const pesoEjemplo = model.probabilityRows
    .map((prob) => classroomRowNumber(prob, ["weight_classroom"]))
    .find((value) => Number.isFinite(value) && value > 0);
  return (
    <div
      className="cmv2-aulas-neff"
      aria-label="Estabilidad de pesos de la selección"
      data-qa-geometry-group="aulas-simulacion-pesos"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="cmv2-subhead">
        <strong>Estabilidad de pesos</strong>
      </div>
      <div className="cmv2-aulas-neff-layout">
        <div className="cmv2-aulas-neff-main">
          <div className="cmv2-aulas-neff-barra" role="img" aria-label={`n efectivo ${fmtDec(nEff)} de ${fmtInt(nNominal)} cursos-horario titulares`}>
            <div className="cmv2-aulas-neff-track" data-estado={(ratio || 0) < 0.5 ? "alerta" : "ok"}>
              <i style={{ width: `${Math.max(4, Math.min(100, (ratio || 0) * 100))}%` }} />
            </div>
            <div className="cmv2-aulas-neff-marcas">
              <span>n efectivo ≈ <b>{fmtDec(nEff)}</b></span>
              <span>n nominal = <b>{fmtInt(nNominal)}</b></span>
            </div>
          </div>
          <FormulaLatex
            expression={"n_{\\mathit{eff}} = \\dfrac{\\left(\\sum_i w_i\\right)^2}{\\sum_i w_i^2}"}
            caption="n efectivo de los cursos-horario titulares"
            badge="validado"
            terms={[
              {
                symbol: "w_i",
                termino: "ponderación (peso)",
                value: pesoEjemplo ? fmtDec(pesoEjemplo, 2) : undefined,
              },
            ]}
          />
          <p className="cmv2-aulas-nota-suave">
            Cada aula seleccionada representa a un número de aulas del marco: ése es su <b>peso</b>, y vale
            el inverso de su probabilidad de entrar al sorteo. Un aula con poca probabilidad representa a
            muchas, así que pesa más. Si los pesos son muy desiguales, unas pocas aulas dominan el resultado
            y la muestra rinde como si fuera más pequeña de lo que es: eso es el <b>n efectivo</b>.
          </p>
        </div>
        <CifraFila>
          {/* «CV de pesos» y «sobre el umbral de alerta» dan por sabido qué es
              un coeficiente de variación y qué significa cruzarlo. Gonzalo,
              2026-08-22: «¿a qué se refiere con CV de pesos?». El rótulo pasa a
              nombrar lo que mide y el detalle a decir qué implica el valor. */}
          <CifraMotor
            label="Desigualdad entre pesos"
            value={fmtDec(cv, 2)}
            detalle={cv > cvWarn
              ? `desiguales: pasa de ${fmtDec(cvWarn, 2)}, el punto donde conviene revisar`
              : `parejos: por debajo de ${fmtDec(cvWarn, 2)}`}
            origen="motor"
            tono={cv > cvWarn ? "alerta" : "ok"}
          />
          <CifraMotor
            label="n efectivo"
            value={fmtDec(nEff)}
            detalle={ratio > 0 ? `${fmtPct(ratio)} del nominal` : detail || "cursos-horario equivalentes tras ponderar"}
            origen="motor"
          />
          <CifraMotor
            label="Qué tan parejos son"
            value={Number.isFinite(score) && score > 0 ? `${fmtDec(score)}/100` : "—"}
            detalle="100 si todas las aulas pesaran igual"
            origen="motor"
            tono={Number.isFinite(score) && score < 50 ? "alerta" : undefined}
          />
        </CifraFila>
      </div>
    </div>
  );
}

/** Histograma de π Monte Carlo: qué tan seguido salió cada aula entre corridas. */
function PiMonteCarloHistogram({ model }: { model: ClassroomLabModel }) {
  const piRows = model.probabilityRows
    .map((row) => classroomRowNumber(row, ["pi_mc"]))
    .filter((value) => Number.isFinite(value) && value > 0);
  const mcRuns = model.probabilityRows
    .map((row) => classroomRowNumber(row, ["mc_runs"]))
    .find((value) => Number.isFinite(value) && value > 0) ?? safeNumber(model.config.simulation_runs, 0);
  if (!piRows.length) return null;
  const bins = Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}–${(i + 1) * 10}%`,
    count: 0,
  }));
  piRows.forEach((pi) => {
    const index = Math.min(9, Math.floor(pi * 10));
    bins[index].count += 1;
  });
  const max = Math.max(1, ...bins.map((bin) => bin.count));
  return (
    <div
      className="cmv2-aulas-histo"
      aria-label="Frecuencia de selección por curso-horario entre corridas"
      data-qa-geometry-group="aulas-simulacion-probabilidades"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="cmv2-subhead">
        <strong>Frecuencia entre corridas</strong>
        <small>{fmtInt(piRows.length)} cursos-horario con probabilidad simulada{mcRuns ? ` en ${fmtInt(mcRuns)} corridas` : ""}</small>
      </div>
      <div className="cmv2-aulas-histo-bins" role="img" aria-label={`Histograma de π Monte Carlo para ${fmtInt(piRows.length)} cursos-horario`}>
        {bins.map((bin) => (
          <div key={bin.label} className="cmv2-aulas-histo-bin">
            <div aria-hidden="true"><i style={{ height: `${Math.max(bin.count ? 8 : 2, (bin.count / max) * 100)}%` }} /></div>
            <strong>{bin.count ? fmtInt(bin.count) : ""}</strong>
            <span>{bin.label}</span>
          </div>
        ))}
      </div>
      <p className="cmv2-aulas-nota-suave">
        Cursos-horario concentrados cerca de 100% salen casi siempre (típico de unidades grandes o de celdas con pocas
        opciones); una cola larga cerca de 0% indica que el sorteo reparte oportunidades entre muchos cursos-horario parecidos.
      </p>
    </div>
  );
}

export function AulasSimulacionTab({
  model,
  busy,
  onCompare,
  onNavigate,
}: {
  model: ClassroomLabModel;
  busy: string | null;
  onCompare: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
  onNavigate?: AulasNavigate;
}) {
  const { comparison, comparisonMethods, comparisonMetrics, simulationRows, recommendedMethodId, engineOption } = model;

  // "Pendiente" solo cuando de verdad no llegó nada: si la selección ya trae
  // π Monte Carlo o estabilidad de pesos, la simulación existe aunque el
  // comparador no haya dejado resumen por método.
  const metodosListos = Boolean(comparison && comparisonMethods.length);
  const evidenciaSimulacion = hasAulasSimulationEvidence(model);

  // El rail de riesgos agrega los flags del motor Y la salud derivada de las
  // cifras validadas (CV sobre umbral, balance fuera de banda, score bajo...):
  // una tarjeta en ámbar nunca debe convivir con un "Sin alertas críticas".
  const riesgosAgregados = [
    ...rowsFrom<Record<string, unknown>>(comparison?.risk_flags),
    ...saludComoRiesgos(saludDesdeModel(model)),
  ];

  const stageNotice = resolveAulasStageNotice(model, "laboratorio");

  return (
    <div className="cmv2-aulas-stack">
      {stageNotice && (
        <AulasStageNotice
          notice={stageNotice}
          onNavigate={onNavigate}
          onAction={stageNotice.localAction === "compare"
            ? () => void onCompare(model.config, model.config.simulation_runs ?? model.config.monte_carlo_n ?? 500)
            : undefined}
          disabled={Boolean(stageNotice.localAction) && (Boolean(busy) || !model.frameReady || !model.hasCalculatedQuota)}
        />
      )}

      {!stageNotice && (
        <ClassroomLabCommandBar
          model={model}
          busy={busy}
          acciones={["estabilidad"]}
          onCompare={onCompare}
        />
      )}

      {(metodosListos || evidenciaSimulacion) && (
        <div className="cmv2-classroom-lab-grid">
          <div className="cmv2-classroom-lab-main">
            {/* K2 (censo f224af2d): primero CÓMO se movió la simulación
                (estabilidad/evidencia), después QUÉ salió (resultados). El
                orden inverso hacía leer conclusiones antes que el proceso. */}
            {evidenciaSimulacion && (
              <div
                className="cmv2-aulas-evidence-stack"
                data-qa-geometry-group="aulas-simulacion-evidencia"
                data-qa-geometry-contract="intrinsic"
              >
                <WeightStabilityBlock model={model} />
                <PiMonteCarloHistogram model={model} />
              </div>
            )}
            <div className="cmv2-subhead">
              <strong>Resultados de la simulación</strong>
            </div>
            {/* Gonzalo, 2026-08-22: «de esas quinientas, ¿se está usando sólo
                para medir la efectividad del método o también para escoger el
                mejor?» y «¿por qué no simulo quinientas y escojo la que más me
                beneficia?». La respuesta no estaba escrita en ninguna pantalla.
                Decidió que se explique en la UI y no se implemente elección por
                resultado. */}
            <p className="cmv2-aulas-simulacion-nota">
              Las corridas <b>miden, no eligen</b>. Repetir el sorteo con semillas distintas sirve
              para dos cosas: ver cuánto cambia el resultado de una vez a otra, y contar con qué
              frecuencia sale cada aula, que es de donde salen los pesos. <b>La selección que va a
              campo es un sorteo aparte</b>, con la semilla que queda registrada.
            </p>
            <p className="cmv2-aulas-simulacion-nota">
              Quedarse con la mejor de las corridas parece gratis y no lo es: lo que hace válida a
              una muestra es <b>el procedimiento, no el resultado</b>. Si se elige la selección por
              su puntaje, las aulas que ayudan a subirlo salen más veces de lo que dice el diseño,
              su probabilidad real deja de ser la declarada y los pesos —que son el inverso de esa
              probabilidad— pasan a mentir. La versión legítima existe, se llama muestreo por
              rechazo y exige fijar los criterios de antemano y recalcular las probabilidades; hoy
              no está implementada. Además, el rango de arriba muestra cuánto se ganaría: suele ser
              de pocos puntos, sobre un puntaje que todavía se está calibrando.
            </p>
            {metodosListos && (
              <>
                {simulationRows.length > 0 && (
                  <SimulationSummaryPanel rows={simulationRows} />
                )}
                <RepresentativityMetricGrid metrics={comparisonMetrics.filter((metric) => metric.method_id === recommendedMethodId)} />
              </>
            )}
          </div>
          <aside className="cmv2-classroom-lab-side">
            <ClassroomRecommendation comparison={comparison} fallbackMethod={engineOption.label} />
            <ClassroomRiskList risks={riesgosAgregados} audited={model.comparisonReady || model.selectionReady}
            resumen
            alcance="Riesgos de la comparación y de la estabilidad"
            onVerDetalle={onNavigate ? () => onNavigate("aulas", "auditoria") : undefined}
          />
          </aside>
        </div>
      )}
    </div>
  );
}
