/**
 * Pestaña "Comparar métodos" (id metodo) de la sección Aulas. Los 4 métodos
 * viven en UNA sola presentación canónica (revamp QA H1): tarjetas con el
 * nombre humano, la elección del método, sus métricas de la última corrida y
 * la acción "Usar método"; el id técnico va a tooltip (H4). Cada tarjeta trae
 * un Popover con la mini-fórmula (la de sistemático-PPS explica por ÚNICA vez
 * el "salto k" y la "pi de inclusión"); siguen la recta numérica del salto y
 * la tabla de balance. La capa didáctica (ComparadorMetodosVisual) se degrada
 * a un bloque colapsado de referencia histórica: sus factores no se recalculan
 * con el marco vigente hasta volver a correr el comparador.
 */
import type { CSSProperties } from "react";
import { Award, BarChart3, Sigma } from "lucide-react";
import type {
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { Popover } from "../../../../components/Popover";
import { ComparadorMetodosVisual } from "../../didactica/ComparadorMetodosVisual";
import { fmtInt, fmtPct, safeNumber } from "../../sharedCore";
import { UNIVERSITY_AULAS_SELECTOR_OPTIONS } from "../shared/constants";
import { AvisoModulo } from "../shared/AvisoModulo";
import { normalizeAulasSelectorEngine, normalizeUniversityAulasConfig } from "../shared/study";
import { FormulaLatex, TerminoChip } from "../ui";
import { DescuentoRepetidosControl } from "./DescuentoRepetidosControl";
import {
  ClassroomBalanceTable,
  ClassroomEmptyState,
  ClassroomLabCommandBar,
  ClassroomRecommendation,
  classroomMethodLabel,
  classroomMethodReason,
  classroomScore,
  type ClassroomLabModel,
} from "./aulasParts";
import { ClassroomRiskList } from "./ClassroomRiskList";
import "../../didactica/didactica.css";
import "./aulas.css";

/** Rol corto por método para la esquina de la tarjeta ("Recomendado" es del
 *  motor, no un rol fijo: lo pinta la tarjeta cuando la corrida lo recomienda). */
const METHOD_BADGES: Record<string, string> = {
  sistematico_pps: "Benchmark",
  cube_balanceado: "Balanceado",
  local_pivotal_balanceado: "Avanzado",
  pool_controlado: "Optimización",
};

/** Mini-fórmulas por método para el Popover de cada tarjeta. */
function MethodFormulaPopover({ methodId }: { methodId: string }) {
  if (methodId === "sistematico_pps") {
    return (
      <div className="cmv2-aulas-chip-pop">
        <strong>Cómo sortea el sistemático-PPS</strong>
        <p>
          Ordena el marco por facultad, calcula el{" "}
          <TerminoChip termino="salto k">salto k</TerminoChip> y toma un curso-horario cada k posiciones
          desde un arranque aleatorio con semilla fija.
        </p>
        <FormulaLatex expression={"k = \\tfrac{N_{CH}}{n_{CH}}"} display={false} />
        <p>
          Cada curso-horario queda con su{" "}
          <TerminoChip termino="pi (probabilidad">pi (probabilidad de inclusión)</TerminoChip>{" "}
          proporcional a su tamaño elegible:
        </p>
        <FormulaLatex expression={"\\pi_i \\propto m_i"} display={false} />
      </div>
    );
  }
  if (methodId === "cube_balanceado") {
    return (
      <div className="cmv2-aulas-chip-pop">
        <strong>Cómo sortea el balanceado (cube)</strong>
        <p>Sortea respetando las probabilidades del diseño, pero obliga a que los totales de la muestra reproduzcan los del marco en las variables de balance:</p>
        <FormulaLatex expression={"\\textstyle\\sum_{i \\in muestra} \\tfrac{x_i}{\\pi_i} \\approx \\sum_{i \\in marco} x_i"} display={false} />
        <p>Con x = facultad, sexo esperado, tamaño del curso-horario y demás variables activas del objetivo.</p>
      </div>
    );
  }
  if (methodId === "local_pivotal_balanceado") {
    return (
      <div className="cmv2-aulas-chip-pop">
        <strong>Cómo sortea el balance + dispersión</strong>
        <p>Método pivotal local: cuando dos cursos-horario se parecen mucho, compiten entre sí, de modo que la muestra queda dispersa en programa, nivel y horario en vez de amontonarse.</p>
        <FormulaLatex expression={"\\pi_i + \\pi_j = cte."} display={false} />
        <p>La suma de probabilidades se conserva en cada duelo local; ningún curso-horario gana probabilidad extra.</p>
      </div>
    );
  }
  return (
    <div className="cmv2-aulas-chip-pop">
      <strong>Cómo funciona el pool controlado</strong>
      <p>Genera muchas muestras candidatas válidas y elige la que menos estudiantes repetidos comparte. Las probabilidades finales ya no son las del diseño: se auditan por simulación.</p>
      <FormulaLatex expression={"\\pi_i^{MC} = \\tfrac{veces\\ seleccionada_i}{corridas}"} display={false} />
    </div>
  );
}

/**
 * Recta numérica del salto sistemático: el marco ordenado como ticks, el
 * arranque aleatorio marcado y los saltos cada k resaltados. Usa el k real
 * (aulas del marco / titulares) cuando hay selección; si no, es ilustrativo.
 */
function SaltoSistematicoRecta({ model }: { model: ClassroomLabModel }) {
  const frameN = model.frameRows.length;
  const titulares = model.m1Rows.length;
  const real = frameN > 1 && titulares > 0 && titulares < frameN;
  const N = real ? frameN : 24;
  const n = real ? titulares : 6;
  const k = Math.max(2, Math.floor(N / n));
  // Arranque de ejemplo derivado de la semilla (el arranque real vive en el
  // motor); sirve para leer el ritmo del sorteo, no para reproducirlo.
  const start = (safeNumber(model.config.semilla, 1) % k) + 1;
  const width = 640;
  const margin = 18;
  // Para conservar el patrón exacto "cada k", si el marco no cabe se muestran
  // las primeras posiciones tal cual (sin muestrear, que distorsiona el ritmo).
  const ticks = Math.min(N, 48);
  const truncated = ticks < N;
  const positions = Array.from({ length: ticks }, (_, i) => ({
    aula: i + 1,
    x: margin + (i / (ticks - 1)) * (width - margin * 2),
  }));
  const isSelected = (aula: number) => aula >= start && (aula - start) % k === 0;
  const firstSelected = positions.find(({ aula }) => isSelected(aula))?.aula ?? start;
  // Orden de encendido de los saltos (stagger de 25ms vía --cmv2-salto-i):
  // los ticks seleccionados se iluminan en secuencia y se lee el "1 de cada k".
  const saltoOrden = new Map<number, number>();
  positions.forEach(({ aula }) => {
    if (isSelected(aula)) saltoOrden.set(aula, saltoOrden.size);
  });
  return (
    <div className="cmv2-aulas-recta" role="img" aria-label={`Recta del salto sistemático: ${fmtInt(N)} cursos-horario ordenados, arranque en la posición ${fmtInt(start)} y un curso-horario cada ${fmtInt(k)} posiciones`}>
      <div className="cmv2-aulas-recta-head">
        <strong>La recta del salto sistemático</strong>
        <small>
          {real
            ? `k = ${fmtInt(frameN)} cursos-horario del marco / ${fmtInt(titulares)} titulares = ${fmtInt(k)}`
            : `ejemplo ilustrativo (sin selección todavía): ${fmtInt(N)} cursos-horario y ${fmtInt(n)} titulares → k = ${fmtInt(k)}`}
          {" · arranque de ejemplo en la posición "}{fmtInt(start)}
          {truncated ? ` · se dibujan las primeras ${fmtInt(ticks)} posiciones de ${fmtInt(N)}` : ""}
        </small>
      </div>
      <svg viewBox={`0 0 ${width} 84`} preserveAspectRatio="xMidYMid meet">
        <line className="cmv2-aulas-recta-linea" x1={margin} y1={46} x2={width - margin} y2={46} />
        {positions.map(({ aula, x }) => {
          const seleccionada = isSelected(aula);
          const esArranque = seleccionada && aula === firstSelected;
          return (
            <g
              key={aula}
              data-salto={seleccionada || undefined}
              style={seleccionada ? ({ "--cmv2-salto-i": saltoOrden.get(aula) ?? 0 } as CSSProperties) : undefined}
            >
              <line
                className={seleccionada ? "cmv2-aulas-recta-tick is-salto" : "cmv2-aulas-recta-tick"}
                x1={x}
                y1={seleccionada ? 32 : 40}
                x2={x}
                y2={seleccionada ? 60 : 52}
              />
              {seleccionada && (
                <circle className="cmv2-aulas-recta-punto" cx={x} cy={46} r={4.5} />
              )}
              {esArranque && (
                <>
                  <path className="cmv2-aulas-recta-flecha" d={`M ${x} 20 L ${x - 5} 10 L ${x + 5} 10 Z`} />
                  <text className="cmv2-aulas-recta-etiqueta" x={x} y={8} textAnchor="middle">arranque</text>
                </>
              )}
            </g>
          );
        })}
        <text className="cmv2-aulas-recta-eje" x={margin} y={78} textAnchor="start">curso-horario 1</text>
        <text className="cmv2-aulas-recta-eje" x={width - margin} y={78} textAnchor="end">curso-horario {fmtInt(ticks)}{truncated ? ` de ${fmtInt(N)}` : ""}</text>
        <text className="cmv2-aulas-recta-eje is-k" x={width / 2} y={78} textAnchor="middle">un curso-horario cada k = {fmtInt(k)} posiciones</text>
      </svg>
    </div>
  );
}

export function AulasMetodoTab({
  workspace,
  model,
  busy,
  onWorkspace,
  onCompare,
  onSelectMethod,
}: {
  workspace: CalcMuestraWorkspace;
  model: ClassroomLabModel;
  busy: string | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onCompare: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
  onSelectMethod: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
}) {
  const { config, comparison, comparisonMethods, recommendedMethodId, engineOption } = model;

  function setSelector(next: string) {
    const nextEngine = normalizeAulasSelectorEngine(next);
    onWorkspace({
      ...workspace,
      aulas_config: normalizeUniversityAulasConfig({
        ...config,
        selector: nextEngine,
        selector_engine: nextEngine,
        method_family: nextEngine === "pool_controlado" ? "probability_with_operational_optimization" : "balanced_probability",
      }),
    });
  }

  function runComparison() {
    void onCompare(config, config.simulation_runs ?? config.monte_carlo_n ?? 500);
  }

  // Decisión del usuario: vive en el workspace (autosave) y manda sobre el
  // eco de la última corrida (ver buildClassroomLabModel). Solo surte efecto
  // al ejecutar una selección nueva.
  function setSequentialDiscount(value: boolean) {
    onWorkspace({
      ...workspace,
      aulas_config: normalizeUniversityAulasConfig({ ...config, sequential_discount: value }),
    });
  }

  const hayComparacion = model.comparisonReady && Boolean(comparison && comparisonMethods.length);

  return (
    <div className="cmv2-aulas-stack">
      <ClassroomLabCommandBar
        model={model}
        busy={busy}
        acciones={["comparar", "seleccionar"]}
        onCompare={onCompare}
        onSelectMethod={onSelectMethod}
      />

      <div className="cmv2-classroom-lab-grid">
        <div className="cmv2-classroom-lab-main">
          <div className="cmv2-subhead">
            <strong>Comparación de métodos</strong>
          </div>
          {/* Presentación canónica ÚNICA de los 4 métodos (QA H1): elección,
              métricas de la última corrida y acción en la misma tarjeta. */}
          <div className="cmv2-classroom-method-grid cmv2-uni-stagger">
            {["sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado"].map((methodId) => {
              const option = UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((item) => item.id === methodId);
              const compared = hayComparacion
                ? comparisonMethods.find((method) => method.method_id === methodId)
                : undefined;
              const active = String(config.selector_engine) === methodId;
              const recomendado = hayComparacion && methodId === recommendedMethodId;
              const label = option?.label ?? classroomMethodLabel(methodId);
              return (
                <div
                  key={methodId}
                  className={`cmv2-classroom-method-card cmv2-aulas-method-card ${active ? "is-active" : ""} ${recomendado ? "is-recommended" : ""}`}
                >
                  <button
                    type="button"
                    className="cmv2-aulas-method-pick"
                    onClick={() => setSelector(methodId)}
                    title={`Identificador técnico: ${methodId}`}
                  >
                    <small>{METHOD_BADGES[methodId] ?? "Método"}</small>
                    <strong>{label}</strong>
                    {recomendado && (
                      <span className="cmv2-aulas-method-reco" aria-label="Recomendado por el comparador">
                        <Award size={11} aria-hidden="true" />
                        Recomendado
                      </span>
                    )}
                    <span>{option?.detail ?? classroomMethodReason(methodId)}</span>
                  </button>
                  {compared && (
                    <div className="cmv2-classroom-quality-metrics" aria-label={`Métricas de ${label}`}>
                      <span><strong>{classroomScore(compared.representativity_score ?? compared.overall_score)}</strong> representatividad</span>
                      <span><strong>{classroomScore(compared.balance_score)}</strong> balance</span>
                      <span><strong>{fmtPct(compared.duplicate_loss ?? 0)}</strong> repetidos</span>
                      <span><strong>{fmtPct(compared.coverage_unique_pct ?? 0)}</strong> cobertura</span>
                    </div>
                  )}
                  <div className="cmv2-aulas-method-foot">
                    <Popover
                      openOn="hover"
                      ariaLabel={`Fórmula del método ${label}`}
                      maxWidth={360}
                      trigger={
                        <button type="button" className="cmv2-aulas-method-formula" aria-label={`Ver fórmula de ${label}`}>
                          <Sigma size={12} />
                          fórmula
                        </button>
                      }
                    >
                      <MethodFormulaPopover methodId={methodId} />
                    </Popover>
                    {compared && (
                      <button
                        type="button"
                        className={recomendado ? "cmv2-primary" : "cmv2-ghost"}
                        onClick={() => void onSelectMethod(config, methodId)}
                        disabled={Boolean(busy) || !model.comparisonReady}
                      >
                        Usar método
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DescuentoRepetidosControl
            checked={config.sequential_discount ?? true}
            selectorEngine={String(config.selector_engine ?? config.selector)}
            onChange={setSequentialDiscount}
          />

          <SaltoSistematicoRecta model={model} />

          {!hayComparacion ? (
            <ClassroomEmptyState
              icon={BarChart3}
              title="Comparación pendiente"
              detail="Corre el comparador para evaluar representatividad, balance, cobertura, repetidos y riesgos de cada método."
              actionLabel="Comparar métodos"
              onAction={runComparison}
              disabled={Boolean(busy) || !model.frameReady || !model.hasCalculatedQuota}
            />
          ) : (
            <ClassroomBalanceTable rows={comparison?.balance ?? []} methodId={recommendedMethodId} />
          )}
        </div>
        <aside className="cmv2-classroom-lab-side">
          <ClassroomRecommendation comparison={comparison} fallbackMethod={engineOption.label} />
          <ClassroomRiskList risks={comparison?.risk_flags ?? []} audited={model.comparisonReady} />
          <AvisoModulo tone="neutral" icon={BarChart3}>
            El PPS queda como base auditable. El método balanceado es el recomendado cuando hay variables
            auxiliares; el pool controlado reduce estudiantes repetidos pero obliga a estimar probabilidades
            finales por simulación.
          </AvisoModulo>
        </aside>
      </div>

      {/* Réplica didáctica de la corrida guardada, DEGRADADA a referencia
          (QA H1): sus factores no se recalculan con el marco vigente hasta
          volver a correr el comparador. Nunca se presenta como evidencia
          comparable ni se elimina. */}
      {hayComparacion && (
        <details className="cmv2-aulas-referencia">
          <summary>Referencia histórica (no recalculada con tu marco)</summary>
          <ComparadorMetodosVisual comparison={comparison} />
        </details>
      )}
    </div>
  );
}
