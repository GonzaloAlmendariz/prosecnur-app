/**
 * Pestaña "Comparar métodos" (id metodo) de la sección Aulas. Arriba la capa
 * didáctica (ComparadorMetodosVisual con las métricas del motor); luego las 4
 * tarjetas de método seleccionables, cada una con un Popover que muestra la
 * mini-fórmula del método (la de sistemático-PPS explica por ÚNICA vez el
 * "salto k" y la "pi de inclusión"); la recta numérica del salto sistemático
 * como visual nuevo; y la recomendación del motor como callout con riesgos y
 * tabla de balance. Command bar: Comparar métodos + Seleccionar titulares.
 */
import type { CSSProperties } from "react";
import { BarChart3, Sigma } from "lucide-react";
import type {
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { Popover } from "../../../../components/Popover";
import { ComparadorMetodosVisual } from "../../didactica/ComparadorMetodosVisual";
import { fmtInt, fmtPct, safeNumber } from "../../sharedCore";
import { UNIVERSITY_AULAS_SELECTOR_OPTIONS } from "../shared/constants";
import { normalizeAulasSelectorEngine, normalizeUniversityAulasConfig } from "../shared/study";
import { FormulaLatex, TerminoChip } from "../ui";
import {
  ClassroomBalanceTable,
  ClassroomEmptyState,
  ClassroomLabCommandBar,
  ClassroomRecommendation,
  ClassroomRiskList,
  MethodSummaryCard,
  classroomMethodLabel,
  classroomMethodReason,
  classroomScore,
  type ClassroomLabModel,
} from "./aulasParts";
import "../../didactica/didactica.css";
import "./aulas.css";

/** Copia corta por método para la esquina de la tarjeta. */
const METHOD_BADGES: Record<string, string> = {
  sistematico_pps: "Benchmark",
  cube_balanceado: "Recomendado",
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
          <TerminoChip termino="salto k">salto k</TerminoChip> y toma un aula cada k posiciones desde
          un arranque aleatorio con semilla fija.
        </p>
        <FormulaLatex expression={"k = \\tfrac{N_{aulas}}{n_{aulas}}"} display={false} />
        <p>
          Cada aula queda con su{" "}
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
        <p>Con x = facultad, sexo esperado, tamaño de aula y demás variables activas del objetivo.</p>
      </div>
    );
  }
  if (methodId === "local_pivotal_balanceado") {
    return (
      <div className="cmv2-aulas-chip-pop">
        <strong>Cómo sortea el balance + dispersión</strong>
        <p>Método pivotal local: cuando dos aulas se parecen mucho, compiten entre sí, de modo que la muestra queda dispersa en programa, nivel y horario en vez de amontonarse.</p>
        <FormulaLatex expression={"\\pi_i + \\pi_j = cte."} display={false} />
        <p>La suma de probabilidades se conserva en cada duelo local; ninguna aula gana probabilidad extra.</p>
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
    <div className="cmv2-aulas-recta" role="img" aria-label={`Recta del salto sistemático: ${fmtInt(N)} aulas ordenadas, arranque en la posición ${fmtInt(start)} y un aula cada ${fmtInt(k)} posiciones`}>
      <div className="cmv2-aulas-recta-head">
        <strong>La recta del salto sistemático</strong>
        <small>
          {real
            ? `k = ${fmtInt(frameN)} aulas del marco / ${fmtInt(titulares)} titulares = ${fmtInt(k)}`
            : `ejemplo ilustrativo (sin selección todavía): ${fmtInt(N)} aulas y ${fmtInt(n)} titulares → k = ${fmtInt(k)}`}
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
        <text className="cmv2-aulas-recta-eje" x={margin} y={78} textAnchor="start">aula 1</text>
        <text className="cmv2-aulas-recta-eje" x={width - margin} y={78} textAnchor="end">aula {fmtInt(ticks)}{truncated ? ` de ${fmtInt(N)}` : ""}</text>
        <text className="cmv2-aulas-recta-eje is-k" x={width / 2} y={78} textAnchor="middle">un aula cada k = {fmtInt(k)} posiciones</text>
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

  return (
    <div className="cmv2-aulas-stack">
      <ComparadorMetodosVisual comparison={comparison} />

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
            <span className="cmv2-eyebrow">Comparación</span>
            <strong>Métodos lado a lado y decisión recomendada</strong>
          </div>
          <div className="cmv2-classroom-method-grid cmv2-uni-stagger">
            {["sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado"].map((methodId) => {
              const option = UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((item) => item.id === methodId);
              const compared = comparisonMethods.find((method) => method.method_id === methodId);
              const active = String(config.selector_engine) === methodId;
              return (
                <div key={methodId} className={`cmv2-classroom-method-card cmv2-aulas-method-card ${active ? "is-active" : ""}`}>
                  <button type="button" className="cmv2-aulas-method-pick" onClick={() => setSelector(methodId)}>
                    <small>{METHOD_BADGES[methodId] ?? "Método"}</small>
                    <strong>{option?.label ?? classroomMethodLabel(methodId)}</strong>
                    <span>{option?.detail ?? classroomMethodReason(methodId)}</span>
                    {compared && <em>Calidad {classroomScore(compared.representativity_score ?? compared.overall_score)} · repetidos {fmtPct(compared.duplicate_loss ?? 0)}</em>}
                  </button>
                  <Popover
                    openOn="hover"
                    ariaLabel={`Fórmula del método ${option?.label ?? methodId}`}
                    maxWidth={360}
                    trigger={
                      <button type="button" className="cmv2-aulas-method-formula" aria-label={`Ver fórmula de ${option?.label ?? methodId}`}>
                        <Sigma size={12} />
                        fórmula
                      </button>
                    }
                  >
                    <MethodFormulaPopover methodId={methodId} />
                  </Popover>
                </div>
              );
            })}
          </div>

          <SaltoSistematicoRecta model={model} />

          {!comparison || !comparisonMethods.length ? (
            <ClassroomEmptyState
              icon={BarChart3}
              title="Comparación pendiente"
              detail="Corre el comparador para evaluar representatividad, balance, cobertura, repetidos y riesgos de cada método."
              actionLabel="Comparar métodos"
              onAction={runComparison}
              disabled={Boolean(busy) || !model.frameReady || !model.hasCalculatedQuota}
            />
          ) : (
            <>
              <div className="cmv2-classroom-quality-grid cmv2-uni-stagger">
                {comparisonMethods.map((method) => (
                  <MethodSummaryCard
                    key={method.method_id}
                    method={method}
                    active={method.method_id === recommendedMethodId}
                    onSelect={() => void onSelectMethod(config, String(method.method_id))}
                  />
                ))}
              </div>
              <ClassroomBalanceTable rows={comparison.balance ?? []} methodId={recommendedMethodId} />
            </>
          )}
        </div>
        <aside className="cmv2-classroom-lab-side">
          <ClassroomRecommendation comparison={comparison} fallbackMethod={engineOption.label} />
          <ClassroomRiskList risks={comparison?.risk_flags ?? []} />
          <div className="cmv2-classroom-note">
            <BarChart3 size={15} />
            <span>El PPS queda como base auditable. El método balanceado es el recomendado cuando hay variables auxiliares; el pool controlado reduce estudiantes repetidos pero obliga a estimar probabilidades finales por simulación.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
