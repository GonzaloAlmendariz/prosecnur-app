/**
 * Pestaña "Supuestos" de Cálculo (id calculo-ajustes). Cada supuesto es una
 * fila: control editable (mismo onComponente del desk), micro-visual que
 * enseña qué mueve, y ayuda contextual con el sustento del viejo
 * AssumptionGuide. deff, tasa de rendimiento y sobremuestra se explican AQUÍ
 * (única explicación del recorrido); al editar con resultado calculado, el
 * desk anula el resultado y esta pestaña avisa que quedó desactualizado con
 * CTA para recalcular.
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Calculator, Loader2 } from "lucide-react";
import type {
  CalcMuestraComponente,
  CalcMuestraParametros,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { fmtInt, fmtPct, safeNumber, type ComponentePatch } from "../../sharedCore";
import {
  ESCENARIOS_OPINION,
  UNIVERSITY_AULAS_SELECTOR_OPTIONS,
  UNIVERSITY_REFERENCE_SUCCESS_RATE,
} from "../shared/constants";
import { normalizeUniversityLabel } from "../shared/format";
import { hasUsefulResult, normalizeUniversityAulasConfig } from "../shared/study";
import { CifraFila, CifraMotor, FormulaLatex } from "../ui";
import { CampoNumero, SwapValor, ltxInt, ltxNum } from "./calculoUi";
import {
  AmbitosSupuesto,
  CampanaZ,
  CurvaP,
  SupuestoFila,
  confianzaDesdeZExacta,
  fmtDecimal,
} from "./parametrosVisuales";
import "../../didactica/didactica.css";
import "./calculo.css";

export function CalculoSupuestosTab({
  totalComp,
  facultyComp,
  workspace,
  onComponente,
  onParametroCompartido,
  onCalcular,
  calculando,
}: {
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
  workspace: CalcMuestraWorkspace;
  onComponente: (id: string, patch: ComponentePatch) => void;
  /** Aplica el mismo patch de parámetros a ambos escenarios en una sola pasada. */
  onParametroCompartido: (patch: Partial<CalcMuestraParametros>) => void;
  onCalcular: () => void;
  calculando: boolean;
}) {
  const total = totalComp.parametros;
  const faculty = facultyComp.parametros;
  const aulasConfig = normalizeUniversityAulasConfig(workspace.aulas_config);
  const calculationReady = hasUsefulResult(totalComp) || hasUsefulResult(facultyComp);
  const hadResult = useRef(calculationReady);
  if (calculationReady) hadResult.current = true;

  // Editar un supuesto anula el resultado en el desk (convención del módulo);
  // aquí recordamos que había un cálculo para avisar que quedó desactualizado.
  const [desactualizado, setDesactualizado] = useState(false);
  useEffect(() => {
    if (calculando) setDesactualizado(false);
  }, [calculando]);

  function editar(id: string, patch: ComponentePatch) {
    if (hadResult.current) setDesactualizado(true);
    onComponente(id, patch);
  }

  function editarCompartido(patch: Partial<CalcMuestraParametros>) {
    if (hadResult.current) setDesactualizado(true);
    onParametroCompartido(patch);
  }

  const totalTarget = safeNumber(totalComp.resultado?.n_objetivo, 0);
  const facultyTarget = safeNumber(facultyComp.resultado?.n_objetivo, 0);
  const aulasBase = Math.max(
    safeNumber(totalComp.resultado?.aulas_base_total, 0),
    safeNumber(facultyComp.resultado?.aulas_base_total, 0),
  );
  const aulasTotal = Math.max(
    safeNumber(totalComp.resultado?.aulas_total, 0),
    safeNumber(facultyComp.resultado?.aulas_total, 0),
  );
  const nReferencia = Math.max(totalTarget, facultyTarget);
  const resultadosPendientes = !totalTarget && !facultyTarget && !aulasBase && !aulasTotal;

  // deff → correlación intra-aula implícita con el tamaño medio de aula.
  const mBarra = Math.max(2, safeNumber(total.promedio_conglomerado, 25));
  const rhoImplicita = (total.deff - 1) / (mBarra - 1);
  const nEfectivo = nReferencia > 0 && total.deff > 0 ? Math.round(nReferencia / total.deff) : null;

  // Tasa de rendimiento: presets de referencia (promedio de estudios reales).
  const tasasReferencia = Array.from(
    new Map(
      Object.entries(UNIVERSITY_REFERENCE_SUCCESS_RATE).map(([label, value]) => [normalizeUniversityLabel(label), value]),
    ).values(),
  );
  const promedioReferencia = tasasReferencia.length
    ? Math.round((tasasReferencia.reduce((sum, v) => sum + v, 0) / tasasReferencia.length) * 100) / 100
    : 0.5;
  const tauEscenario = safeNumber(ESCENARIOS_OPINION[0].parametros.tau, 0.53);
  const tau = safeNumber(total.tau, tauEscenario);
  const intentos = nReferencia > 0 && tau > 0 ? Math.ceil(nReferencia / tau) : null;

  const confianzaTotal = confianzaDesdeZExacta(total.z);
  const selectorLabel = UNIVERSITY_AULAS_SELECTOR_OPTIONS.find(
    (option) => option.id === (aulasConfig.selector_engine ?? aulasConfig.selector),
  )?.label ?? String(aulasConfig.selector_engine ?? aulasConfig.selector);

  return (
    <div className="cmv2-calc-stack">
      <section className="cmv2-calc-supuestos-panel">
        {resultadosPendientes ? (
          <div className="cmv2-calc-pending-strip" role="status">
            <Calculator size={16} aria-hidden="true" />
            <strong>Resultados pendientes</strong>
            <span>Configura los supuestos y calcula para obtener N y cursos-horario.</span>
          </div>
        ) : (
          <div className="cmv2-calc-resultados-strip">
            <CifraFila>
              <CifraMotor
                label="N universidad"
                value={totalTarget ? fmtInt(totalTarget) : "pendiente"}
                detalle="encuestas objetivo"
                origen={totalTarget ? "motor" : undefined}
              />
              <CifraMotor
                label="N facultades"
                value={facultyTarget ? fmtInt(facultyTarget) : "pendiente"}
                detalle="suma de cuotas mínimas"
                origen={facultyTarget ? "motor" : undefined}
              />
              <CifraMotor
                label="Cursos-horario base"
                value={aulasBase ? fmtInt(aulasBase) : "pendiente"}
                detalle="cursos-horario titulares estimados"
                origen={aulasBase ? "motor" : undefined}
              />
              <CifraMotor
                label="Cursos-horario con reemplazos"
                value={aulasTotal ? fmtInt(aulasTotal) : "pendiente"}
                detalle="plan operativo completo"
                origen={aulasTotal ? "motor" : undefined}
              />
            </CifraFila>
          </div>
        )}

        {desactualizado && (
          <div className="cmv2-calc-aviso" role="status">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>
              El resultado quedó desactualizado: los supuestos cambiaron después del último
              cálculo validado.
            </span>
            <button type="button" className="cmv2-primary" onClick={onCalcular} disabled={calculando}>
              {calculando ? <Loader2 size={13} className="pulso-spin" /> : <Calculator size={13} />}
              Recalcular
            </button>
          </div>
        )}

        <div className="cmv2-calc-supuestos cmv2-uni-stagger">
          <SupuestoFila
            id="confianza"
            titulo="Confianza y precisión"
            resumen="El z fija cuánta seguridad exige el diseño; el margen de error, qué tan fina debe ser la lectura."
            popover={
              <>
                <strong>Precisión</strong>
                <p>Baja el error solo si necesitas más precisión y aceptas un N mayor.</p>
                <p>
                  El error global vive aquí ({fmtPct(total.e)}); las facultades{" "}
                  {facultyComp.tecnica === "prob_estratificado_independiente"
                    ? "definen su margen por fila en el marco"
                    : `usan ${fmtPct(faculty.e)}`}.
                </p>
              </>
            }
            controles={
              <>
                <CampoNumero label="Confianza z (universidad)" value={total.z} step={0.01} onChange={(v) => editar(totalComp.id, { parametros: { z: v } })} />
                <CampoNumero label="Confianza z (facultades)" value={faculty.z} step={0.01} onChange={(v) => editar(facultyComp.id, { parametros: { z: v } })} />
                <CampoNumero label="Error global e" value={total.e} step={0.005} suffix="prop." onChange={(v) => editar(totalComp.id, { parametros: { e: v } })} />
              </>
            }
            visual={
              /* z se edita por pasos discretos: el swap funde el área ±z de la
                 campana en vez de que el polígono salte de una forma a otra. */
              <SwapValor firma={`z:${total.z}`}>
                <CampanaZ z={total.z} zFacultades={faculty.z} />
                <p className="cmv2-calc-svg-nota">
                  En Universidad, z = {fmtDecimal(total.z, 2)} cubre ≈{fmtDecimal(confianzaTotal * 100, 1)}% de la campana:
                  solo el {fmtDecimal((1 - confianzaTotal) * 100, 1)}% más extremo queda fuera.
                </p>
              </SwapValor>
            }
          />

          <SupuestoFila
            id="p"
            titulo="Proporción esperada (p)"
            resumen="Qué tan frecuente esperamos el fenómeno que medimos; define la varianza p·(1−p) de la fórmula."
            popover={
              <>
                <strong>Variabilidad</strong>
                <p>p y DEFF protegen incertidumbre y similitud dentro de cursos-horario; subirlos incrementa N.</p>
                <p>
                  p = 0.5 es el escenario más exigente (varianza máxima); una p calibrada con
                  evidencia previa reduce el n sin perder respaldo.
                </p>
              </>
            }
            controles={
              <>
                <CampoNumero label="p esperada (universidad)" value={total.p} step={0.01} onChange={(v) => editar(totalComp.id, { parametros: { p: v } })} />
                <CampoNumero label="p esperada (facultades)" value={faculty.p} step={0.01} onChange={(v) => editar(facultyComp.id, { parametros: { p: v } })} />
              </>
            }
            visual={
              <>
                <CurvaP p={total.p} pFacultades={faculty.p} />
                <p className="cmv2-calc-svg-nota">
                  La varianza p·(1−p) es máxima en 0,5; con p = {fmtDecimal(total.p, 2)} Universidad
                  trabaja con {fmtDecimal(4 * total.p * (1 - total.p) * 100, 0)}% de esa exigencia.
                </p>
              </>
            }
          />

          <SupuestoFila
            id="deff"
            titulo="Efecto de diseño (deff)"
            resumen="Encuestar cursos-horario completos agrupa estudiantes parecidos; el deff compensa esa pérdida de información."
            popover={
              <>
                <strong>Variabilidad por conglomerados</strong>
                <p>p y DEFF protegen incertidumbre y similitud dentro de cursos-horario; subirlos incrementa N.</p>
                <p>
                  Supuesto sensible: al cambiarlo se debe recalcular antes de comparar métodos o
                  generar la selección de cursos-horario.
                </p>
              </>
            }
            controles={
              <>
                <CampoNumero label="deff (universidad)" value={total.deff} step={0.1} onChange={(v) => editar(totalComp.id, { parametros: { deff: v } })} />
                <CampoNumero label="deff (facultades)" value={faculty.deff} step={0.1} onChange={(v) => editar(facultyComp.id, { parametros: { deff: v } })} />
              </>
            }
            visual={
              <>
                <AmbitosSupuesto
                  universidad={`deff = ${fmtDecimal(total.deff, 2)}`}
                  facultades={`deff = ${fmtDecimal(faculty.deff, 2)}`}
                />
                <FormulaLatex
                  expression={String.raw`\mathit{deff} = 1 + (\bar{m} - 1)\,\rho = 1 + (${ltxNum(mBarra, 0)} - 1) \times ${ltxNum(rhoImplicita, 3)}`}
                  caption="De dónde sale el deff aplicado"
                  terms={[
                    { symbol: "m̄", termino: "curso-horario", value: `${fmtDecimal(mBarra, 0)} por curso-horario` },
                    { symbol: "ρ", termino: "deff", value: `ρ implícita ${fmtDecimal(rhoImplicita, 3)}` },
                  ]}
                />
                {nEfectivo != null ? (
                  <div className="cmv2-calc-minibar" aria-label="n efectivo frente a n nominal">
                    <div className="cmv2-calc-minibar-fila">
                      <span>n nominal</span>
                      <i><b style={{ width: "100%" }} /></i>
                      <strong>{fmtInt(nReferencia)}</strong>
                    </div>
                    <div className="cmv2-calc-minibar-fila" data-tono="soft">
                      <span>n efectivo</span>
                      <i><b style={{ width: `${Math.max(6, Math.min(100, (100 / total.deff)))}%` }} /></i>
                      <strong>{fmtInt(nEfectivo)}</strong>
                    </div>
                    <p className="cmv2-calc-svg-nota">
                      En Universidad, deff = {fmtDecimal(total.deff, 2)}: las {fmtInt(nReferencia)} encuestas del diseño aportan la información de ≈{fmtInt(nEfectivo)} entrevistas independientes.
                    </p>
                  </div>
                ) : (
                  <p className="cmv2-calc-svg-nota">La barra n efectivo vs n nominal aparece con el primer cálculo validado.</p>
                )}
              </>
            }
          />

          <SupuestoFila
            id="rendimiento"
            titulo="Tasa de rendimiento y sobremuestra"
            resumen="No todo curso-horario rinde completo: la tasa de rendimiento convierte encuestas objetivo en intentos de campo, y la sobremuestra agrega colchón."
            popover={
              <>
                <strong>Campo y rendimiento por curso-horario</strong>
                <p>La sobremuestra cubre no respuesta esperada; no reemplaza las rutas de reemplazo por curso-horario.</p>
                <p>El rendimiento define cuántos estudiantes efectivos esperamos captar por curso y horario.</p>
                <p>
                  Sobremuestra no es reserva: las rutas Rn.1, Rn.2… son reemplazos trazables que
                  Monitoreo activa sin rediseñar el marco.
                </p>
              </>
            }
            controles={
              <>
                <label className="cmv2-did-slider cmv2-calc-tau">
                  <div className="cmv2-did-slider-head">
                    <span>Tasa de rendimiento (τ)</span>
                    <output>{Math.round(tau * 100)}%</output>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.01}
                    value={tau}
                    onChange={(ev) => editarCompartido({ tau: Number(ev.target.value) })}
                  />
                </label>
                <div className="cmv2-calc-presets" role="group" aria-label="Tasas de referencia">
                  <button type="button" data-active={Math.abs(tau - promedioReferencia) < 0.005} onClick={() => editarCompartido({ tau: promedioReferencia })}>
                    promedio de estudios de referencia · {Math.round(promedioReferencia * 100)}%
                  </button>
                  <button type="button" data-active={Math.abs(tau - tauEscenario) < 0.005} onClick={() => editarCompartido({ tau: tauEscenario })}>
                    escenario base de cursos-horario · {Math.round(tauEscenario * 100)}%
                  </button>
                </div>
                <CampoNumero label="Sobremuestra (universidad)" value={total.oversample_pct} step={0.05} suffix="prop." onChange={(v) => editar(totalComp.id, { parametros: { oversample_pct: v } })} />
                <CampoNumero label="Sobremuestra (facultades)" value={faculty.oversample_pct} step={0.05} suffix="prop." onChange={(v) => editar(facultyComp.id, { parametros: { oversample_pct: v } })} />
              </>
            }
            visual={
              <>
                <AmbitosSupuesto
                  universidad={`τ ${Math.round(tau * 100)}% · sobremuestra ${fmtPct(total.oversample_pct)}`}
                  facultades={`τ ${Math.round(tau * 100)}% · sobremuestra ${fmtPct(faculty.oversample_pct)}`}
                />
                <FormulaLatex
                  expression={intentos != null
                    ? String.raw`n_{\mathit{campo}} = \left\lceil \dfrac{n}{\tau} \right\rceil = \left\lceil \dfrac{${ltxInt(nReferencia)}}{${ltxNum(tau, 2)}} \right\rceil = ${ltxInt(intentos)}`
                    : String.raw`n_{\mathit{campo}} = \left\lceil \dfrac{n}{\tau} \right\rceil`}
                  caption={intentos != null
                    ? "Lectura operativa sobre el n objetivo validado por la calculadora"
                    : "Se llena con el primer cálculo validado"}
                  terms={[
                    { symbol: "τ", termino: "tasa de rendimiento", value: `${Math.round(tau * 100)}%` },
                    { symbol: "sobremuestra", termino: "sobremuestra", value: fmtPct(total.oversample_pct) },
                  ]}
                />
                {intentos != null && (
                  <p className="cmv2-calc-svg-nota">
                    Para lograr {fmtInt(nReferencia)} encuestas completas hay que intentar
                    ≈{fmtInt(intentos)} en cursos-horario: cada curso-horario rinde alrededor del {Math.round(tau * 100)}%
                    de sus matriculados elegibles.
                  </p>
                )}
              </>
            }
          />
        </div>

        <p className="cmv2-calc-supuestos-foot">
          Reemplazos: {fmtInt(aulasConfig.bolsas_reemplazo)} niveles y +{fmtInt(aulasConfig.aulas_extra_operativas_default)}{" "}
          cursos-horario extra por dominio — unidades equivalentes para campo que Monitoreo activa sin rediseñar el
          marco. El método de selección ({selectorLabel}) se decide después de fijar N y cuotas, en la
          sección Selección.
        </p>
      </section>
    </div>
  );
}
