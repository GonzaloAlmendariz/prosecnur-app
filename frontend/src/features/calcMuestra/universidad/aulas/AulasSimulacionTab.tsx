/**
 * Pestaña "Simulación" (id laboratorio) de la sección Aulas. Responde "¿el
 * resultado es estable o depende de una corrida?": resumen de corridas por
 * método y métricas del recomendado (conservados), un bloque nuevo de
 * estabilidad de pesos (micro-barra n_eff vs n nominal + fórmula del n
 * efectivo — aquí se explica por ÚNICA vez la ponderación w_i = 1/π_i — y
 * cifras del motor) y el histograma de frecuencia de selección por aula entre
 * corridas (π Monte Carlo) cuando el motor lo trae.
 */
import { BarChart3 } from "lucide-react";
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../api/client";
import { fmtInt, fmtPct, safeNumber } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import { CifraFila, CifraMotor, FormulaLatex, TerminoChip } from "../ui";
import {
  ClassroomEmptyState,
  ClassroomLabCommandBar,
  ClassroomRecommendation,
  ClassroomRiskList,
  RepresentativityMetricGrid,
  SimulationSummaryPanel,
  type ClassroomLabModel,
} from "./aulasParts";
import "../../didactica/didactica.css";
import "./aulas.css";

function fmtDecimal(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits).replace(".", ",") : "—";
}

/** Estabilidad de pesos: micro-barra n_eff vs n nominal + fórmula + cifras. */
function WeightStabilityBlock({ model }: { model: ClassroomLabModel }) {
  const row = model.weightStability;
  if (!row) {
    return (
      <div className="cmv2-classroom-empty is-compact">
        <span><BarChart3 size={16} /></span>
        <div>
          <strong>Estabilidad de pesos pendiente</strong>
          <em>Cuando exista una selección, la calculadora calcula el CV de los pesos y el n efectivo de las aulas titulares.</em>
        </div>
      </div>
    );
  }
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
    <div className="cmv2-aulas-neff" aria-label="Estabilidad de pesos de la selección">
      <div className="cmv2-subhead">
        <span className="cmv2-eyebrow">Estabilidad de pesos</span>
        <strong>¿Cuánta muestra "efectiva" queda tras ponderar?</strong>
      </div>
      <div className="cmv2-aulas-neff-layout">
        <div className="cmv2-aulas-neff-main">
          <div className="cmv2-aulas-neff-barra" role="img" aria-label={`n efectivo ${fmtDecimal(nEff)} de ${fmtInt(nNominal)} aulas titulares`}>
            <div className="cmv2-aulas-neff-track">
              <i style={{ width: `${Math.max(4, Math.min(100, (ratio || 0) * 100))}%` }} />
            </div>
            <div className="cmv2-aulas-neff-marcas">
              <span>n efectivo ≈ {fmtDecimal(nEff)}</span>
              <span>n nominal = {fmtInt(nNominal)}</span>
            </div>
          </div>
          <FormulaLatex
            expression={"n_{\\mathit{eff}} = \\dfrac{\\left(\\sum_i w_i\\right)^2}{\\sum_i w_i^2}"}
            caption="n efectivo de las aulas titulares"
            badge="validado"
            terms={[
              {
                symbol: "w_i",
                termino: "ponderación (peso)",
                value: pesoEjemplo ? fmtDecimal(pesoEjemplo, 2) : undefined,
              },
            ]}
          />
          <p className="cmv2-aulas-nota-suave">
            Cada aula pesa w_i = 1/π_i (el inverso de su probabilidad de inclusión). Si los pesos son muy
            desiguales, unas pocas aulas dominan la estimación y el n efectivo cae por debajo del nominal.
          </p>
        </div>
        <CifraFila>
          <CifraMotor
            label="CV de pesos"
            value={fmtDecimal(cv, 2)}
            detalle={cv > cvWarn ? `sobre el umbral de alerta (${fmtDecimal(cvWarn, 2)})` : "dispersión de los pesos"}
            origen="motor"
            tono={cv > cvWarn ? "alerta" : "ok"}
          />
          <CifraMotor
            label="n efectivo"
            value={fmtDecimal(nEff)}
            detalle={ratio > 0 ? `${fmtPct(ratio)} del nominal` : detail || "aulas equivalentes tras ponderar"}
            origen="motor"
          />
          <CifraMotor
            label="Puntaje de estabilidad"
            value={Number.isFinite(score) && score > 0 ? `${fmtDecimal(score)}/100` : "—"}
            detalle="100 = pesos parejos"
            origen="motor"
            tono={Number.isFinite(score) && score < 50 ? "alerta" : undefined}
          />
        </CifraFila>
      </div>
    </div>
  );
}

/** Histograma de π Monte Carlo: qué tan seguido salió cada aula entre corridas. */
function PiMonteCarloHistogram({ model, onCompare, busy }: {
  model: ClassroomLabModel;
  busy: string | null;
  onCompare: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
}) {
  const piRows = model.probabilityRows
    .map((row) => classroomRowNumber(row, ["pi_mc"]))
    .filter((value) => Number.isFinite(value) && value > 0);
  const mcRuns = model.probabilityRows
    .map((row) => classroomRowNumber(row, ["mc_runs"]))
    .find((value) => Number.isFinite(value) && value > 0) ?? safeNumber(model.config.simulation_runs, 0);
  if (!piRows.length) {
    return (
      <ClassroomEmptyState
        icon={BarChart3}
        title="Sin frecuencias de selección por aula"
        detail="La calculadora aún no trae π Monte Carlo por aula. Corre el comparador con corridas de auditoría para estimar qué tan seguido saldría cada aula."
        actionLabel="Comparar métodos"
        onAction={() => void onCompare(model.config, model.config.simulation_runs ?? model.config.monte_carlo_n ?? 500)}
        disabled={Boolean(busy) || !model.frameReady || !model.hasCalculatedQuota}
      />
    );
  }
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
    <div className="cmv2-aulas-histo" aria-label="Frecuencia de selección por aula entre corridas">
      <div className="cmv2-subhead">
        <span className="cmv2-eyebrow">Frecuencia entre corridas</span>
        <strong>¿Qué tan seguido salió cada aula? (π Monte Carlo)</strong>
        <small>{fmtInt(piRows.length)} aulas con probabilidad simulada{mcRuns ? ` en ${fmtInt(mcRuns)} corridas` : ""}</small>
      </div>
      <div className="cmv2-aulas-histo-bins" role="img" aria-label={`Histograma de π Monte Carlo para ${fmtInt(piRows.length)} aulas`}>
        {bins.map((bin) => (
          <div key={bin.label} className="cmv2-aulas-histo-bin">
            <div aria-hidden="true"><i style={{ height: `${Math.max(bin.count ? 8 : 2, (bin.count / max) * 100)}%` }} /></div>
            <strong>{bin.count ? fmtInt(bin.count) : ""}</strong>
            <span>{bin.label}</span>
          </div>
        ))}
      </div>
      <p className="cmv2-aulas-nota-suave">
        Aulas concentradas cerca de 100% salen casi siempre (típico de aulas grandes o de celdas con pocas
        opciones); una cola larga cerca de 0% indica que el sorteo reparte oportunidades entre muchas aulas parecidas.
      </p>
    </div>
  );
}

export function AulasSimulacionTab({
  model,
  busy,
  onCompare,
}: {
  model: ClassroomLabModel;
  busy: string | null;
  onCompare: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
}) {
  const { comparison, comparisonMethods, comparisonMetrics, simulationRows, recommendedMethodId, engineOption } = model;
  return (
    <div className="cmv2-aulas-stack">
      <ClassroomLabCommandBar model={model} busy={busy} acciones={["comparar"]} onCompare={onCompare} />

      <div className="cmv2-classroom-lab-grid">
        <div className="cmv2-classroom-lab-main">
          <div className="cmv2-subhead">
            <span className="cmv2-eyebrow">Simulación</span>
            <strong>Estabilidad, cobertura y estudiantes repetidos</strong>
          </div>
          {!comparison || !comparisonMethods.length ? (
            <ClassroomEmptyState
              icon={BarChart3}
              title="Simulación pendiente"
              detail="Corre el comparador para generar corridas presupuestadas y observar variabilidad del diseño antes de seleccionar."
              actionLabel="Comparar métodos"
              onAction={() => void onCompare(model.config, model.config.simulation_runs ?? model.config.monte_carlo_n ?? 500)}
              disabled={Boolean(busy) || !model.frameReady || !model.hasCalculatedQuota}
            />
          ) : (
            <>
              <SimulationSummaryPanel rows={simulationRows} />
              <RepresentativityMetricGrid metrics={comparisonMetrics.filter((metric) => metric.method_id === recommendedMethodId)} />
            </>
          )}
          <WeightStabilityBlock model={model} />
          <PiMonteCarloHistogram model={model} busy={busy} onCompare={onCompare} />
        </div>
        <aside className="cmv2-classroom-lab-side">
          <ClassroomRecommendation comparison={comparison} fallbackMethod={engineOption.label} />
          <ClassroomRiskList risks={comparison?.risk_flags ?? []} />
        </aside>
      </div>
    </div>
  );
}
