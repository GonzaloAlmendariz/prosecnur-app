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
import { resumenTasaEfectividad } from "./estadisticoAula";
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
      label: "cursos-horario estimados",
      valor: r?.aulas_total ? fmtInt(r.aulas_total) : undefined,
      detalle: "titulares + reemplazos",
      estado: r?.aulas_total ? "ready" : "pending",
    },
  ];
}

/** Exportada para poder probar la tarjeta sin montar la pestaña entera. */
export function EscenarioCard({
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
  // El motor pone `precision_alcanzada` en NA y llena `advertencia` cuando el
  // cálculo va SIN margen de error formal —marco sin validar, deff < 1, τ fuera
  // de (0,1]—. El `??` caía entonces a la estimación del cliente, así que la
  // tarjeta pintaba una precisión donde el motor había dicho que no la hay, y
  // la advertencia que explica por qué no se mostraba en ninguna parte.
  //
  // Con advertencia del motor no se estima: se dice lo que pasa.
  const advertenciaMotor = String(comp.resultado?.advertencia ?? "").trim();
  const sinMargenFormal = advertenciaMotor.length > 0;
  const precision = porFacultad || sinMargenFormal
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
      {sinMargenFormal && (
        <div className="cmv2-calc-sin-margen" role="status">
          <ShieldAlert size={15} aria-hidden="true" />
          <div>
            <strong>Este resultado no tiene margen de error formal</strong>
            <span>{advertenciaMotor}</span>
          </div>
        </div>
      )}
      <div className="cmv2-calc-escenario-foot">
        {belowMinimum
          ? "El n final no puede ser menor al mínimo calculado."
          : porFacultad
            ? `Ajuste sobre la fórmula: ${fmtSignedInt(extra)}. Cada facultad conserva su propio margen de error y p esperada.`
            // Una sola guarda: el pie deriva de que no haya precisión, en vez de
            // repetir la condición que la anula. Con la condición duplicada,
            // quitar una de las dos no cambiaba nada observable —y un mutante
            // que no cambia nada no lo detecta ningún test—.
            : precision == null
              ? `Ajuste sobre la fórmula: ${fmtSignedInt(extra)}.`
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
  ) ?? null;
  const cuotasRows = cuotasComp ? universityDistributionRows(cuotasComp) : [];
  const totalCuotas = cuotasRows.reduce((sum, row) => sum + row.n, 0);

  // Parámetros elegidos en Diseño (universidad): se muestran para que Propuestas
  // ejecute sobre valores explícitos, nunca cifras escritas a mano.
  const g = componentes[0].parametros;
  const paramsElegidos: Array<{ label: string; value: string; nota?: string }> = [
    { label: "z", value: fmtNum(g.z, 2) },
    { label: "p", value: fmtNum(g.p, 2) },
    { label: "e", value: `±${fmtNum(g.e * 100, 1)}%` },
    { label: "deff", value: fmtNum(g.deff, 2) },
    // La tasa de efectividad se nombra, no se escribe en griego: es la única
    // de estas cifras que NO sale del diseño que el usuario acaba de fijar,
    // sino de un valor de referencia heredado (0,53 en el preset de
    // universidad, medido en el estudio anterior). Quien recibe la app veía
    // «τ 53%» sin saber ni qué es ni de dónde viene, y aplicándose a su
    // estudio en silencio.
    // Y tampoco es UNA tasa: el reparto usa la de cada facultad, así que el
    // chip anuncia el rango cuando difieren (Gonzalo: «creo que esto ya no es
    // cierto»).
    {
      label: "tasa de efectividad",
      ...(() => {
        const r = resumenTasaEfectividad(
          componentes[0].resultado?.aulas_por_estrato as Array<{ tau?: unknown }> | null | undefined,
          safeNumber(g.tau, 0.7),
        );
        return { value: r.valor, nota: r.nota };
      })(),
    },
  ];

  return (
    <div
      className="cmv2-calc-stack"
      // Sin esta declaración el gate visual auditaba sólo el resumen del
      // toolbar y daba «ok=true» sin haber mirado la pestaña. `intrinsic`
      // porque sus paneles —las propuestas, los parámetros, las cifras— tienen
      // alturas propias y no deben igualarse entre sí.
      data-qa-geometry-group="calc-muestra/calculo-propuestas"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="cmv2-panel cmv2-calc-escenarios-panel" data-qa-geometry-member>
        <div className="cmv2-panel-head">
          <strong>Propuestas de muestra</strong>
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
        <div className="cmv2-calc-params-elegidos" aria-label="Parámetros elegidos en Diseño">
          <span className="cmv2-calc-params-eyebrow">Parámetros del diseño</span>
          {paramsElegidos.map((param) => (
            <span key={param.label} className="cmv2-calc-param-chip" title={param.nota}>
              <code>{param.label}</code>
              <strong>{param.value}</strong>
            </span>
          ))}
          <span className="cmv2-calc-param-nota">Ambas propuestas se ejecutan con estos valores (la Propuesta 2, con la p por facultad).</span>
        </div>
        {!hasCalculation ? (
          <EmptyState
            icon={<Calculator size={20} />}
            title={marcoReady ? "Todavía no hay cálculo de muestra" : "Primero falta validar el marco"}
            hint={marcoReady
              ? "Al ejecutar Calcular muestra, cada escenario mostrará su flujo de n fórmula a cursos-horario, con cifras validadas de la calculadora."
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
            <strong>Cuotas por facultad · P2</strong>
            <span className="cmv2-pill-soft">Propuesta 2 · {fmtInt(totalCuotas)} entrevistas asignadas</span>
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
                </tr>
              </thead>
              <tbody>
                {cuotasRows.map((row) => (
                  <tr key={row.facultad}>
                    <td><strong>{row.facultad}</strong></td>
                    <td>{fmtInt(row.N)}</td>
                    <td>{fmtInt(row.mujeres)}</td>
                    <td>{fmtInt(row.hombres)}</td>
                    <td><strong>{fmtInt(row.n)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="cmv2-calc-cuotas-nota">
            Los cursos-horario requeridos se confirman en su pestaña. La composición P1/P2 completa vive en «Distribución».
          </p>
        </section>
      )}
    </div>
  );
}
