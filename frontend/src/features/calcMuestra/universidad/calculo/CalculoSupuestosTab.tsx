/**
 * Pestaña "Supuestos" de Cálculo (id calculo-ajustes). Cada supuesto es una
 * fila: control editable (mismo onComponente del desk), micro-visual que
 * enseña qué mueve, y popover "¿por qué importa?" con el sustento del viejo
 * AssumptionGuide. deff, tasa de rendimiento y sobremuestra se explican AQUÍ
 * (única explicación del recorrido); al editar con resultado calculado, el
 * desk anula el resultado y esta pestaña avisa que quedó desactualizado con
 * CTA para recalcular.
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Calculator, CircleHelp, Loader2 } from "lucide-react";
import type {
  CalcMuestraComponente,
  CalcMuestraParametros,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { Popover } from "../../../../components/Popover";
import { zFromConfidence } from "../../didactica/motorPreview";
import { fmtInt, fmtPct, safeNumber, type ComponentePatch } from "../../sharedCore";
import {
  ESCENARIOS_OPINION,
  UNIVERSITY_AULAS_SELECTOR_OPTIONS,
  UNIVERSITY_REFERENCE_SUCCESS_RATE,
} from "../shared/constants";
import { normalizeUniversityLabel } from "../shared/format";
import { hasUsefulResult, normalizeUniversityAulasConfig } from "../shared/study";
import { CifraFila, CifraMotor, FormulaLatex } from "../ui";
import { CampoNumero, SwapValor, fmtNum, ltxInt, ltxNum } from "./calculoUi";
import "../../didactica/didactica.css";
import "./calculo.css";

/** Confianza bilateral desde z, invirtiendo la MISMA réplica qnorm del motor. */
function confianzaDesdeZExacta(z: number) {
  let lo = 0.5;
  let hi = 0.9999;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (zFromConfidence(mid) < z) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Micro-curva p·(1−p) con marcador en el p actual. */
function CurvaP({ p }: { p: number }) {
  const puntos: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    puntos.push(`${(8 + t * 144).toFixed(1)},${(56 - 4 * t * (1 - t) * 42).toFixed(1)}`);
  }
  const px = 8 + Math.min(Math.max(p, 0), 1) * 144;
  const py = 56 - 4 * p * (1 - p) * 42;
  return (
    <svg
      className="cmv2-calc-svg"
      viewBox="0 0 160 64"
      role="img"
      aria-label={`Curva de varianza p por (1 menos p) con marcador en p = ${fmtNum(p, 2)}`}
    >
      <line x1="8" y1="56" x2="152" y2="56" className="cmv2-calc-svg-eje" />
      <line x1="80" y1="56" x2="80" y2="12" className="cmv2-calc-svg-guia" />
      {/* pathLength=1 normaliza el trazo para el draw-in CSS de una sola vez */}
      <polyline points={puntos.join(" ")} pathLength={1} className="cmv2-calc-svg-curva cmv2-calc-svg-draw" />
      {/* El marcador vive en (0,0) y se posiciona con transform para que el
          CSS lo deslice suave al cambiar p, en vez de saltar de cx a cx. */}
      <circle
        cx={0}
        cy={0}
        r="3.5"
        className="cmv2-calc-svg-punto cmv2-calc-svg-punto-movil"
        style={{ transform: `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)` }}
      />
    </svg>
  );
}

/** Mini-campana normal con el área central cubierta por ±z sombreada. */
function CampanaZ({ z }: { z: number }) {
  const X = (t: number) => 8 + ((t + 3.4) / 6.8) * 144;
  const Y = (t: number) => 58 - Math.exp((-t * t) / 2) * 46;
  const curva: string[] = [];
  for (let i = 0; i <= 68; i++) {
    const t = -3.4 + (i / 68) * 6.8;
    curva.push(`${X(t).toFixed(1)},${Y(t).toFixed(1)}`);
  }
  const zc = Math.min(Math.max(Math.abs(z), 0.4), 3.3);
  const area: string[] = [`${X(-zc).toFixed(1)},58.0`];
  for (let i = 0; i <= 40; i++) {
    const t = -zc + (i / 40) * 2 * zc;
    area.push(`${X(t).toFixed(1)},${Y(t).toFixed(1)}`);
  }
  area.push(`${X(zc).toFixed(1)},58.0`);
  return (
    <svg
      className="cmv2-calc-svg"
      viewBox="0 0 160 64"
      role="img"
      aria-label={`Curva normal con z = ${fmtNum(z, 2)} marcado`}
    >
      <polygon points={area.join(" ")} className="cmv2-calc-svg-area cmv2-calc-svg-revela" />
      <polyline points={curva.join(" ")} pathLength={1} className="cmv2-calc-svg-curva cmv2-calc-svg-draw" />
      <line x1={X(-zc)} y1="58" x2={X(-zc)} y2={Y(-zc)} className="cmv2-calc-svg-marca cmv2-calc-svg-revela" />
      <line x1={X(zc)} y1="58" x2={X(zc)} y2={Y(zc)} className="cmv2-calc-svg-marca cmv2-calc-svg-revela" />
      <line x1="8" y1="58" x2="152" y2="58" className="cmv2-calc-svg-eje" />
    </svg>
  );
}

function SupuestoFila({
  id,
  titulo,
  resumen,
  popover,
  controles,
  visual,
}: {
  id: string;
  titulo: string;
  resumen: string;
  popover: React.ReactNode;
  controles: React.ReactNode;
  visual: React.ReactNode;
}) {
  return (
    <article className="cmv2-calc-supuesto" data-supuesto={id}>
      <div className="cmv2-calc-supuesto-info">
        <div className="cmv2-calc-supuesto-titulo">
          <strong>{titulo}</strong>
          <Popover
            openOn="hover"
            ariaLabel={`Por qué importa ${titulo}`}
            trigger={
              <button type="button" className="cmv2-calc-porque">
                <CircleHelp size={13} aria-hidden="true" /> ¿por qué importa?
              </button>
            }
          >
            <div className="cmv2-calc-porque-pop">{popover}</div>
          </Popover>
        </div>
        <p className="cmv2-calc-supuesto-resumen">{resumen}</p>
        <div className="cmv2-calc-supuesto-controles">{controles}</div>
      </div>
      <div className="cmv2-calc-supuesto-visual">{visual}</div>
    </article>
  );
}

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
      <section className="cmv2-panel cmv2-calc-supuestos-panel">
        <div className="cmv2-panel-head">
          <div>
            <span className="cmv2-eyebrow">Supuestos del cálculo</span>
            <strong>Qué mueve el tamaño de muestra y qué mueve aulas</strong>
          </div>
          <span className="cmv2-pill-soft">editar con intención · antes de elegir aulas</span>
        </div>
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
            label="Aulas base"
            value={aulasBase ? fmtInt(aulasBase) : "pendiente"}
            detalle="titulares estimadas"
            origen={aulasBase ? "motor" : undefined}
          />
          <CifraMotor
            label="Aulas con reemplazos"
            value={aulasTotal ? fmtInt(aulasTotal) : "pendiente"}
            detalle="plan operativo completo"
            origen={aulasTotal ? "motor" : undefined}
          />
        </CifraFila>

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
                <CampanaZ z={total.z} />
                <p className="cmv2-calc-svg-nota">
                  z = {fmtNum(total.z, 2)} cubre ≈{fmtNum(confianzaTotal * 100, 1)}% de la campana:
                  solo el {fmtNum((1 - confianzaTotal) * 100, 1)}% más extremo queda fuera.
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
                <p>p y DEFF protegen incertidumbre y similitud dentro de aulas; subirlos incrementa N.</p>
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
                <CurvaP p={total.p} />
                <p className="cmv2-calc-svg-nota">
                  La varianza p·(1−p) es máxima en 0.5; con p = {fmtNum(total.p, 2)} el diseño
                  trabaja con {fmtNum(4 * total.p * (1 - total.p) * 100, 0)}% de esa exigencia.
                </p>
              </>
            }
          />

          <SupuestoFila
            id="deff"
            titulo="Efecto de diseño (deff)"
            resumen="Encuestar aulas completas agrupa estudiantes parecidos; el deff compensa esa pérdida de información."
            popover={
              <>
                <strong>Variabilidad por conglomerados</strong>
                <p>p y DEFF protegen incertidumbre y similitud dentro de aulas; subirlos incrementa N.</p>
                <p>
                  Supuesto sensible: al cambiarlo se debe recalcular antes de comparar métodos o
                  generar la selección de aulas.
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
                <FormulaLatex
                  expression={String.raw`\mathit{deff} = 1 + (\bar{m} - 1)\,\rho = 1 + (${ltxNum(mBarra, 0)} - 1) \times ${ltxNum(rhoImplicita, 3)}`}
                  caption="De dónde sale el deff aplicado"
                  terms={[
                    { symbol: "m̄", termino: "curso-horario", value: `${fmtNum(mBarra, 0)} por aula` },
                    { symbol: "ρ", termino: "deff", value: `ρ implícita ${fmtNum(rhoImplicita, 3)}` },
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
                      Con deff = {fmtNum(total.deff, 2)}, las {fmtInt(nReferencia)} encuestas del diseño aportan la información de ≈{fmtInt(nEfectivo)} entrevistas independientes.
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
            resumen="No toda aula rinde completa: la tasa de rendimiento convierte encuestas objetivo en intentos de campo, y la sobremuestra agrega colchón."
            popover={
              <>
                <strong>Campo y rendimiento por aula</strong>
                <p>La sobremuestra cubre no respuesta esperada; no reemplaza las rutas de reemplazo por aula.</p>
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
                    escenario base de aulas · {Math.round(tauEscenario * 100)}%
                  </button>
                </div>
                <CampoNumero label="Sobremuestra (universidad)" value={total.oversample_pct} step={0.05} suffix="prop." onChange={(v) => editar(totalComp.id, { parametros: { oversample_pct: v } })} />
                <CampoNumero label="Sobremuestra (facultades)" value={faculty.oversample_pct} step={0.05} suffix="prop." onChange={(v) => editar(facultyComp.id, { parametros: { oversample_pct: v } })} />
              </>
            }
            visual={
              <>
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
                    ≈{fmtInt(intentos)} en aula: cada aula rinde alrededor del {Math.round(tau * 100)}%
                    de sus matriculados elegibles.
                  </p>
                )}
              </>
            }
          />
        </div>

        <p className="cmv2-calc-supuestos-foot">
          Reemplazos: {fmtInt(aulasConfig.bolsas_reemplazo)} niveles y +{fmtInt(aulasConfig.aulas_extra_operativas_default)}{" "}
          aulas extra por dominio — aulas equivalentes para campo que Monitoreo activa sin rediseñar el
          marco. El método de selección ({selectorLabel}) se decide después de fijar N y cuotas, en la
          sección Aulas.
        </p>
      </section>
    </div>
  );
}
