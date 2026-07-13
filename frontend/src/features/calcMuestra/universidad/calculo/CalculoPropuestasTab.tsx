/**
 * Pestaña "Propuestas" de Cálculo (id calculo-propuestas). Cada escenario
 * (universidad / facultad) es una tarjeta con el flujo horizontal de cifras
 * del motor (n fórmula → n ajustado → n operativo → aulas), la fórmula del
 * escenario en KaTeX y el editor de n final con su piso mínimo (no se puede
 * pedir menos que el n de fórmula). Debajo, la afijación proporcional, la
 * tabla de cuotas por facultad y la distribución por facultad y sexo del
 * motor (mudada aquí desde la antigua guía).
 */
import { useEffect, useRef, useState } from "react";
import { Calculator, Loader2, ShieldAlert } from "lucide-react";
import type {
  CalcMuestraComponente,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { Popover } from "../../../../components/Popover";
import { EmptyState } from "../../../../components/States";
import { DistribucionFacultadSexo } from "../../didactica/DistribucionFacultadSexo";
import { calcEPreview } from "../../didactica/motorPreview";
import { fmtInt, fmtPct, fmtSignedInt, roundUpTo, safeNumber } from "../../sharedCore";
import { ESCENARIOS_OPINION, UNIVERSITY_FACULTY_COMPONENT_ID } from "../shared/constants";
import { esCenso } from "../shared/salud";
import {
  componentFormulaBase,
  hasUsefulResult,
  proposalShortLabel,
  universityDistributionRows,
} from "../shared/study";
import { FlujoVertical, FormulaLatex, type FlujoEtapa } from "../ui";
import { useValorSwap } from "../ui/useValorSwap";
import { CadenaAfijacion } from "./CadenaAfijacion";
import { SwapValor, fmtNum } from "./calculoUi";
import "../../didactica/didactica.css";
import "./calculo.css";

function etapasEscenario(comp: CalcMuestraComponente): FlujoEtapa[] {
  const r = comp.resultado;
  const listo = hasUsefulResult(comp);
  return [
    {
      id: "formula",
      label: "n fórmula",
      valor: r?.n_teorico != null ? fmtInt(r.n_teorico) : undefined,
      detalle: "Cochran + deff + FPC",
      estado: r?.n_teorico != null ? "ready" : "pending",
    },
    {
      id: "ajustado",
      label: "n ajustado",
      valor: listo ? fmtInt(r?.n_objetivo) : undefined,
      detalle: "redondeo o meta aplicada",
      estado: listo ? "ready" : "pending",
    },
    {
      id: "operativo",
      label: "n operativo",
      valor: listo && r?.n_operativo ? fmtInt(r.n_operativo) : undefined,
      detalle: r?.sobremuestra ? `+${fmtInt(r.sobremuestra)} de sobremuestra` : "con sobremuestra",
      estado: listo && r?.n_operativo ? "ready" : "pending",
    },
    {
      id: "aulas",
      label: "aulas estimadas",
      valor: r?.aulas_total ? fmtInt(r.aulas_total) : undefined,
      detalle: "titulares + reemplazos",
      estado: r?.aulas_total ? "ready" : "pending",
    },
  ];
}

function EscenarioCard({
  comp,
  redondeoMultiplo,
  draft,
  onDraftTarget,
  onApplyTarget,
  calculando,
}: {
  comp: CalcMuestraComponente;
  redondeoMultiplo: number;
  draft: number;
  onDraftTarget: (componentId: string, value: number) => void;
  onApplyTarget: (componentId: string, value: number) => void;
  calculando: boolean;
}) {
  const porFacultad = comp.tecnica === "prob_estratificado_independiente";
  const params = comp.parametros;
  const formula = comp.resultado?.n_teorico ?? componentFormulaBase(comp);
  const rounded = roundUpTo(formula, redondeoMultiplo);
  const belowMinimum = formula != null && draft > 0 && draft < formula;
  const extra = formula != null && draft > 0 ? draft - formula : null;
  const precision = porFacultad
    ? null
    : comp.resultado?.precision_alcanzada ??
      calcEPreview(draft, comp.marco.marco_validado, params.p, params.z, params.deff);

  // Shake sutil SOLO al intentar un n por debajo del piso (transición
  // válido → inválido); mientras siga inválido no se repite.
  const [shake, setShake] = useState(false);
  const prevBelow = useRef(belowMinimum);
  useEffect(() => {
    if (belowMinimum && !prevBelow.current) setShake(true);
    if (!belowMinimum) setShake(false);
    prevBelow.current = belowMinimum;
  }, [belowMinimum]);

  // El pill del piso funde su cifra cuando el motor recalcula el n de fórmula.
  const pisoCambiando = useValorSwap(formula ?? "—");

  // Salud del escenario: un n objetivo que iguala o supera el N del marco es
  // un censo, no una muestra (mismas cifras validadas del motor, solo lectura).
  const nObjetivo = safeNumber(comp.resultado?.n_objetivo, 0);
  const marcoN = safeNumber(comp.marco.marco_validado, 0);
  const escenarioCensal = esCenso(nObjetivo, marcoN);

  return (
    <article className={`cmv2-calc-escenario ${belowMinimum ? "is-warning" : ""}`}>
      <div className="cmv2-calc-escenario-head">
        <div>
          <span className="cmv2-eyebrow">{proposalShortLabel(comp)}</span>
          <h3>{comp.actor}</h3>
        </div>
      </div>
      {escenarioCensal && (
        <div className="cmv2-calc-censo" role="alert">
          <ShieldAlert size={15} aria-hidden="true" />
          <div>
            <strong>
              El n objetivo ({fmtInt(nObjetivo)}) iguala o supera la población (N={fmtInt(marcoN)}): esto es un censo, no una muestra
            </strong>
            <span>
              Con n ≥ N no hay margen de error que defender. Revisa la meta aplicada o los parámetros antes de cerrar el escenario.
            </span>
          </div>
        </div>
      )}
      <div className="cmv2-calc-stagger">
        <FlujoVertical
          etapas={etapasEscenario(comp)}
          orientacion="horizontal"
          ariaLabel={`Del n de fórmula al plan operativo (${proposalShortLabel(comp)})`}
        />
      </div>
      <SwapValor firma={`f:${comp.resultado?.n_teorico ?? "—"}:${comp.marco.marco_validado ?? "—"}`}>
        <FormulaLatex
          expression={String.raw`n=\dfrac{N\,z^2\,p\,(1-p)\,\mathit{deff}}{(N-1)\,e^2+z^2\,p\,(1-p)\,\mathit{deff}}`}
          caption="Fórmula del escenario (explicada paso a paso en Parámetros)"
          terms={[
            { symbol: "N", termino: "marco muestral", value: fmtInt(comp.marco.marco_validado) },
            { symbol: "z", termino: "nivel de confianza", value: fmtNum(params.z, 2) },
            { symbol: "p", termino: "p (proporción", value: porFacultad ? "por facultad" : fmtNum(params.p, 2) },
            { symbol: "e", termino: "margen de error", value: porFacultad ? "por facultad" : `±${fmtNum(params.e * 100, 1)}%` },
            { symbol: "deff", termino: "deff", value: fmtNum(params.deff, 2) },
          ]}
        />
      </SwapValor>
      <div className="cmv2-calc-objetivo">
        <label
          className="cmv2-target-input"
          data-roto={belowMinimum || undefined}
          data-shake={shake || undefined}
          onAnimationEnd={() => setShake(false)}
        >
          <span>n final propuesto</span>
          <span className="cmv2-number-cell">
            <input
              type="number"
              min={1}
              step={50}
              value={draft || ""}
              onChange={(e) => onDraftTarget(comp.id, safeNumber(e.currentTarget.value, 0))}
            />
          </span>
        </label>
        <Popover
          openOn="hover"
          ariaLabel="Piso mínimo del n final"
          trigger={
            <button
              type="button"
              className="cmv2-calc-piso cmv2-uni-swap"
              data-roto={belowMinimum || undefined}
              data-cambiando={pisoCambiando || undefined}
            >
              piso: {formula != null ? fmtInt(formula) : "—"}
            </button>
          }
        >
          <div className="cmv2-calc-piso-pop">
            <strong>No puedes pedir menos que el n de fórmula</strong>
            <p>
              El n de fórmula es el mínimo que garantiza el margen de error y la confianza
              prometidos. Puedes redondear hacia arriba o fijar una meta mayor, pero un n
              menor rompería la precisión del diseño y no se puede aplicar.
            </p>
          </div>
        </Popover>
        <div className="cmv2-inline-actions">
          <button
            type="button"
            className="cmv2-ghost"
            onClick={() => rounded && onDraftTarget(comp.id, rounded)}
            disabled={!rounded || calculando}
          >
            Usar redondeo a {fmtInt(redondeoMultiplo)}
          </button>
          <button
            type="button"
            className="cmv2-primary"
            onClick={() => onApplyTarget(comp.id, draft)}
            disabled={!draft || belowMinimum || calculando}
          >
            Aplicar ajuste
          </button>
        </div>
      </div>
      <div className="cmv2-calc-escenario-foot">
        {belowMinimum
          ? "El n final no puede ser menor al mínimo calculado."
          : porFacultad
            ? `Ajuste sobre la fórmula: ${fmtSignedInt(extra)}. Cada facultad conserva su propio margen de error y p esperada.`
            : `Ajuste sobre la fórmula: ${fmtSignedInt(extra)} · precisión estimada con este n: ${fmtPct(precision)}.`}
      </div>
    </article>
  );
}

export function CalculoPropuestasTab({
  componentes,
  workspace,
  marcoReady,
  draftTargets,
  onDraftTarget,
  onApplyTarget,
  onCalcular,
  calculando,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  workspace: CalcMuestraWorkspace;
  marcoReady: boolean;
  draftTargets: Record<string, number>;
  onDraftTarget: (componentId: string, value: number) => void;
  onApplyTarget: (componentId: string, value: number) => void;
  onCalcular: () => void;
  calculando: boolean;
}) {
  const scenarios = workspace.escenarios.length ? workspace.escenarios : ESCENARIOS_OPINION;
  const hasCalculation = componentes.some((comp) => hasUsefulResult(comp));
  const cuotasComp = componentes.find(
    (comp) => comp.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID && (comp.resultado?.distribucion_estratos ?? []).length,
  ) ?? componentes.find((comp) => (comp.resultado?.distribucion_estratos ?? []).length) ?? null;
  const cuotasRows = cuotasComp ? universityDistributionRows(cuotasComp) : [];
  const aulasPorEstrato = cuotasComp?.resultado?.aulas_por_estrato ?? [];
  const totalCuotas = cuotasRows.reduce((sum, row) => sum + row.n, 0);
  const distribucionResultado = cuotasComp?.resultado ?? componentes[0].resultado;

  return (
    <div className="cmv2-calc-stack">
      <section className="cmv2-panel cmv2-calc-escenarios-panel">
        <div className="cmv2-panel-head">
          <div>
            <span className="cmv2-eyebrow">Propuestas de muestra</span>
            <strong>Dos escenarios sobre el mismo marco</strong>
          </div>
          <div className="cmv2-panel-head-actions">
            <button type="button" className="cmv2-primary" onClick={onCalcular} disabled={!marcoReady || calculando}>
              {calculando ? <Loader2 size={14} className="pulso-spin" /> : <Calculator size={14} />}
              {hasCalculation ? "Recalcular muestra" : "Calcular muestra"}
            </button>
            <span className="cmv2-pill-soft">
              {hasCalculation ? "cifras de la calculadora" : marcoReady ? "lista para calcular" : "requiere marco"}
            </span>
          </div>
        </div>
        {!hasCalculation ? (
          <EmptyState
            icon={<Calculator size={20} />}
            title={marcoReady ? "Todavía no hay cálculo de muestra" : "Primero falta validar el marco"}
            hint={marcoReady
              ? "Al ejecutar Calcular muestra, cada escenario mostrará su flujo de n fórmula a aulas, con cifras validadas de la calculadora."
              : "Carga y valida la base institucional para que el cálculo no dependa de números escritos a mano."}
          />
        ) : (
          <div className="cmv2-calc-escenarios cmv2-uni-stagger">
            {componentes.map((comp) => {
              const scenario = scenarios.find((e) => e.component_id === comp.id);
              const formula = comp.resultado?.n_teorico ?? componentFormulaBase(comp);
              const rounded = roundUpTo(formula, scenario?.redondeo_multiplo ?? 100);
              const applied = safeNumber(comp.meta.valor) > 0 ? Math.round(comp.meta.valor) : rounded;
              return (
                <EscenarioCard
                  key={comp.id}
                  comp={comp}
                  redondeoMultiplo={scenario?.redondeo_multiplo ?? 100}
                  draft={draftTargets[comp.id] ?? applied ?? 0}
                  onDraftTarget={onDraftTarget}
                  onApplyTarget={onApplyTarget}
                  calculando={calculando}
                />
              );
            })}
          </div>
        )}
      </section>

      {cuotasRows.length > 0 && (
        <section className="cmv2-panel cmv2-calc-cuotas-panel">
          <div className="cmv2-panel-head">
            <div>
              <span className="cmv2-eyebrow">Cuotas por facultad</span>
              <strong>Cómo se reparte el n final entre facultades</strong>
            </div>
            <span className="cmv2-pill-soft">{fmtInt(totalCuotas)} entrevistas asignadas</span>
          </div>
          {cuotasComp && <CadenaAfijacion comp={cuotasComp} rows={cuotasRows} />}
          <FormulaLatex
            expression={String.raw`n_h = n \cdot \tfrac{N_h}{N}`}
            badge="validado"
            caption="Afijación proporcional: cada facultad aporta según su peso en el marco"
            terms={[
              { symbol: "n_h", termino: "cuota" },
              { symbol: "N_h", termino: "estrato" },
            ]}
          />
          <div className="cmv2-table-wrap cmv2-calc-cuotas-tabla">
            <table className="cmv2-table cmv2-table--university">
              <thead>
                <tr>
                  <th>Facultad</th>
                  <th>Marco (N_h)</th>
                  <th>Mujeres</th>
                  <th>Hombres</th>
                  <th>Cuota (n_h)</th>
                  {aulasPorEstrato.length > 0 && <th>Aulas</th>}
                </tr>
              </thead>
              <tbody>
                {cuotasRows.map((row) => {
                  const aulas = aulasPorEstrato.find((a) => a.estrato === row.facultad);
                  return (
                    <tr key={row.facultad}>
                      <td><strong>{row.facultad}</strong></td>
                      <td>{fmtInt(row.N)}</td>
                      <td>{fmtInt(row.mujeres)}</td>
                      <td>{fmtInt(row.hombres)}</td>
                      <td><strong>{fmtInt(row.n)}</strong></td>
                      {aulasPorEstrato.length > 0 && <td>{aulas ? fmtInt(aulas.aulas_total) : "—"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DistribucionFacultadSexo resultado={distribucionResultado} />
        </section>
      )}
    </div>
  );
}
