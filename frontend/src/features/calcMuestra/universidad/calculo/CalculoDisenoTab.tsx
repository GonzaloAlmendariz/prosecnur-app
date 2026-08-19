/**
 * Pestaña «Diseño» de Cálculo (id calculo-diseno) — el único hogar de los
 * parámetros de la fórmula. Tres cometidos y nada más:
 *   1. conocer LA FÓRMULA (Cochran + deff + FPC, con cada término explicado),
 *   2. entender QUÉ SIGNIFICA cada parámetro (campana ±z, curva p·(1−p), deff),
 *   3. REGULAR cada parámetro con CONFIRMACIÓN EXPLÍCITA: editar mueve un
 *      borrador y nada toca el estudio hasta «Aplicar cambios».
 *
 * Fusiona el contenido de la antigua pestaña «Supuestos» (me, p, deff,
 * rendimiento y campo) y añade parámetros A NIVEL DE FACULTAD (p por facultad),
 * que la Propuesta 2 necesita. NO trae la barra de KPIs ejecutados, la cifra de
 * diseño, la bolsa operativa ni los escenarios: eso vive en Propuestas y en la
 * pestaña de Cursos-horario requeridos.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, Calculator, Check, Loader2, RotateCcw, Sigma } from "lucide-react";
import type {
  CalcMuestraComponente,
  CalcMuestraParametros,
  CalcMuestraReferenciaAsistencia,
} from "../../../../api/client";
import { fmtInt, fmtPct, safeNumber } from "../../sharedCore";
import { hasUsefulResult } from "../shared/study";
import { FormulaLatex } from "../ui";
import { CampoNumero, SwapValor, ltxInt, ltxNum } from "./calculoUi";
import { ReferenciaAsistenciaTau } from "./ReferenciaAsistenciaTau";
import {
  CampanaZ,
  CurvaP,
  SupuestoFila,
  confianzaDesdeZExacta,
  fmtDecimal,
} from "./parametrosVisuales";
import "../../didactica/didactica.css";
import "./calculo.css";

type ParamPatch = Partial<CalcMuestraParametros>;

/** Diferencias reales entre borrador y comprometido, para el resumen de confirmación. */
function difs(committed: CalcMuestraParametros, draft: ParamPatch): Array<keyof CalcMuestraParametros> {
  return (Object.keys(draft) as Array<keyof CalcMuestraParametros>).filter(
    (key) => draft[key] != null && draft[key] !== committed[key],
  );
}

export function CalculoDisenoTab({
  totalComp,
  facultyComp,
  marcoReady,
  onSetComponentes,
  onCalcular,
  calculando,
  referenciaAsistencia = null,
}: {
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
  marcoReady: boolean;
  /** Commit atómico de ambos escenarios (evita el pisado de dos updates seguidos). */
  onSetComponentes: (componentes: CalcMuestraComponente[]) => void;
  onCalcular: () => void;
  calculando: boolean;
  referenciaAsistencia?: CalcMuestraReferenciaAsistencia | null;
}) {
  const [draftTotal, setDraftTotal] = useState<ParamPatch>({});
  const [draftFaculty, setDraftFaculty] = useState<ParamPatch>({});
  // p por facultad: override por id de estrato; vacío = usa la p global.
  const [draftP, setDraftP] = useState<Record<string, number>>({});

  const total = totalComp.parametros;
  const faculty = facultyComp.parametros;
  const estratos = facultyComp.marco.estratos ?? [];

  // Valores efectivos = comprometido + borrador (mueven la fórmula en vivo).
  const eff = <K extends keyof CalcMuestraParametros>(base: CalcMuestraParametros, patch: ParamPatch, key: K) =>
    (patch[key] ?? base[key]) as number;
  const zT = eff(total, draftTotal, "z");
  const zF = eff(faculty, draftFaculty, "z");
  const pT = eff(total, draftTotal, "p");
  const pF = eff(faculty, draftFaculty, "p");
  const eT = eff(total, draftTotal, "e");
  const deffT = eff(total, draftTotal, "deff");
  const deffF = eff(faculty, draftFaculty, "deff");
  const tau = eff(total, draftTotal, "tau");
  const oversampleT = eff(total, draftTotal, "oversample_pct");
  const oversampleF = eff(faculty, draftFaculty, "oversample_pct");
  const N = safeNumber(totalComp.marco.marco_validado, 0);

  const cambiosTotal = difs(total, draftTotal);
  const cambiosFaculty = difs(faculty, draftFaculty);
  const cambiosP = Object.keys(draftP).filter((id) => {
    const est = estratos.find((e) => e.id === id);
    return est != null && draftP[id] !== safeNumber(est.p_facultad, faculty.p);
  });
  const sucio = cambiosTotal.length > 0 || cambiosFaculty.length > 0 || cambiosP.length > 0;

  const habiaResultado = hasUsefulResult(totalComp) || hasUsefulResult(facultyComp);
  const [desactualizado, setDesactualizado] = useState(false);

  const setTotal = (patch: ParamPatch) => setDraftTotal((prev) => ({ ...prev, ...patch }));
  const setFaculty = (patch: ParamPatch) => setDraftFaculty((prev) => ({ ...prev, ...patch }));
  const setCompartido = (patch: ParamPatch) => {
    setDraftTotal((prev) => ({ ...prev, ...patch }));
    setDraftFaculty((prev) => ({ ...prev, ...patch }));
  };

  function descartar() {
    setDraftTotal({});
    setDraftFaculty({});
    setDraftP({});
  }

  function aplicar() {
    const nextTotal: CalcMuestraComponente = {
      ...totalComp,
      parametros: { ...total, ...draftTotal },
      resultado: null,
    };
    const nextEstratos = estratos.map((est) =>
      draftP[est.id] != null ? { ...est, p_facultad: draftP[est.id] } : est,
    );
    const nextFaculty: CalcMuestraComponente = {
      ...facultyComp,
      parametros: { ...faculty, ...draftFaculty },
      marco: { ...facultyComp.marco, estratos: nextEstratos },
      resultado: null,
    };
    onSetComponentes([nextTotal, nextFaculty]);
    if (habiaResultado) setDesactualizado(true);
    descartar();
  }

  // deff → correlación intra-aula implícita con el tamaño medio de aula.
  const mBarra = Math.max(2, safeNumber(total.promedio_conglomerado, 25));
  const rhoImplicita = (deffT - 1) / (mBarra - 1);
  const confianzaTotal = confianzaDesdeZExacta(zT);

  const q = 1 - pT;
  const formula = useMemo(
    () =>
      N > 0
        /* El denominador también se instancia: quedaba en «…» y el margen de
           error e —el parámetro que más se discute— era el único que nunca
           aparecía con su número en la fracción. La promesa de esta tarjeta
           es la fórmula CON tus números, entera. */
        ? String.raw`n=\dfrac{N\,z^2\,p\,(1-p)\,\mathit{deff}}{(N-1)\,e^2+z^2\,p\,(1-p)\,\mathit{deff}}=\dfrac{${ltxInt(N)}\cdot ${ltxNum(zT, 2)}^2\cdot ${ltxNum(pT, 2)}\cdot ${ltxNum(q, 2)}\cdot ${ltxNum(deffT, 2)}}{${ltxInt(N - 1)}\cdot ${ltxNum(eT, 3)}^2+${ltxNum(zT, 2)}^2\cdot ${ltxNum(pT, 2)}\cdot ${ltxNum(q, 2)}\cdot ${ltxNum(deffT, 2)}}`
        : String.raw`n=\dfrac{N\,z^2\,p\,(1-p)\,\mathit{deff}}{(N-1)\,e^2+z^2\,p\,(1-p)\,\mathit{deff}}`,
    [N, zT, pT, q, deffT],
  );

  const porFacultadIndep = facultyComp.tecnica === "prob_estratificado_independiente";

  return (
    <div className="cmv2-calc-stack">
      <section className="cmv2-panel cmv2-calc-diseno-panel">
        <div className="cmv2-panel-head">
          <strong>La fórmula del diseño</strong>
          <span className="cmv2-pill-soft">
            {N > 0 ? `N = ${fmtInt(N)} del marco` : "requiere marco validado"}
          </span>
        </div>
        <SwapValor firma={`f:${N}:${zT}:${pT}:${deffT}`} className="cmv2-calc-diseno-formula">
          <FormulaLatex
            expression={formula}
            caption="Poblaciones finitas con efecto de diseño (Cochran + deff + FPC)"
            terms={[
              { symbol: "N", termino: "marco muestral", value: N > 0 ? fmtInt(N) : "—" },
              { symbol: "z", termino: "nivel de confianza", value: fmtDecimal(zT, 2) },
              { symbol: "p", termino: "proporción esperada", value: fmtDecimal(pT, 2) },
              { symbol: "e", termino: "margen de error", value: `±${fmtDecimal(eT * 100, 1)}%` },
              { symbol: "deff", termino: "deff", value: fmtDecimal(deffT, 2) },
            ]}
          />
        </SwapValor>
        {/* S3: el riel de pestañas ya dice dónde vive cada paso y el botón de
            confirmar ya declara que el cambio es explícito. De las tres frases
            solo la primera aportaba algo que la pantalla no muestra: que aquí
            se regula, no se ejecuta. */}
        <p className="cmv2-calc-diseno-nota">
          <Sigma size={13} aria-hidden="true" />
          Aquí se regulan los parámetros; la cifra se ejecuta en <strong>Propuestas</strong>.
        </p>
      </section>

      <section className="cmv2-calc-supuestos-panel">
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
                  El error global vive aquí ({fmtPct(eT)}); las facultades{" "}
                  {porFacultadIndep ? "definen su margen por fila en el marco" : `usan ${fmtPct(faculty.e)}`}.
                </p>
              </>
            }
            controles={
              <>
                <CampoNumero label="Confianza z (universidad)" value={zT} step={0.01} onChange={(v) => setTotal({ z: v })} />
                <CampoNumero label="Confianza z (facultades)" value={zF} step={0.01} onChange={(v) => setFaculty({ z: v })} />
                <CampoNumero label="Error global e" value={eT} step={0.005} suffix="prop." onChange={(v) => setTotal({ e: v })} />
              </>
            }
            visual={
              <SwapValor firma={`z:${zT}:${zF}`}>
                <CampanaZ z={zT} zFacultades={zF} />
                <p className="cmv2-calc-svg-nota">
                  En Universidad, z = {fmtDecimal(zT, 2)} cubre ≈{fmtDecimal(confianzaTotal * 100, 1)}% de la campana:
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
                <p>p = 0.5 es el escenario más exigente; la p por facultad (abajo) afina la Propuesta 2.</p>
              </>
            }
            controles={
              <>
                <CampoNumero label="p esperada (universidad)" value={pT} step={0.01} onChange={(v) => setTotal({ p: v })} />
                <CampoNumero label="p esperada (facultades)" value={pF} step={0.01} onChange={(v) => setFaculty({ p: v })} />
              </>
            }
            visual={
              <>
                <CurvaP p={pT} pFacultades={pF} />
                <p className="cmv2-calc-svg-nota">
                  La varianza p·(1−p) es máxima en 0.5; con p = {fmtDecimal(pT, 2)} Universidad
                  trabaja con {fmtDecimal(4 * pT * (1 - pT) * 100, 0)}% de esa exigencia.
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
                <p>Supuesto sensible: al cambiarlo se recalcula antes de comparar métodos o generar la selección.</p>
              </>
            }
            controles={
              <>
                <CampoNumero label="deff (universidad)" value={deffT} step={0.1} onChange={(v) => setTotal({ deff: v })} />
                <CampoNumero label="deff (facultades)" value={deffF} step={0.1} onChange={(v) => setFaculty({ deff: v })} />
              </>
            }
            visual={
              <FormulaLatex
                expression={String.raw`\mathit{deff} = 1 + (\bar{m} - 1)\,\rho = 1 + (${ltxNum(mBarra, 0)} - 1) \times ${ltxNum(rhoImplicita, 3)}`}
                caption="De dónde sale el deff aplicado"
                terms={[
                  { symbol: "m̄", termino: "curso-horario", value: `${fmtDecimal(mBarra, 0)} por curso-horario` },
                  { symbol: "ρ", termino: "deff", value: `ρ implícita ${fmtDecimal(rhoImplicita, 3)}` },
                ]}
              />
            }
          />

          <SupuestoFila
            id="rendimiento"
            titulo="Supuestos operativos: rendimiento y campo"
            resumen="No todo curso-horario rinde completo: la tasa de rendimiento (τ) convierte encuestas objetivo en intentos, y la sobremuestra agrega colchón."
            popover={
              <>
                <strong>Campo y rendimiento por curso-horario</strong>
                <p>La sobremuestra cubre no respuesta esperada; no reemplaza las rutas de reemplazo por curso-horario.</p>
                <p>El rendimiento define cuántos estudiantes efectivos esperamos captar por curso y horario.</p>
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
                    onChange={(ev) => setCompartido({ tau: Number(ev.target.value) })}
                  />
                </label>
                <CampoNumero label="Sobremuestra (universidad)" value={oversampleT} step={0.05} suffix="prop." onChange={(v) => setTotal({ oversample_pct: v })} />
                <CampoNumero label="Sobremuestra (facultades)" value={oversampleF} step={0.05} suffix="prop." onChange={(v) => setFaculty({ oversample_pct: v })} />
              </>
            }
            visual={
              <>
                <p className="cmv2-calc-svg-nota">
                  Con τ = {Math.round(tau * 100)}%, lograr 100 encuestas completas exige intentar
                  ≈{fmtInt(Math.ceil(100 / Math.max(tau, 0.01)))} por curso-horario. La sobremuestra
                  (universidad {fmtPct(oversampleT)}) es colchón adicional, no reemplazo.
                </p>
                <ReferenciaAsistenciaTau tauActual={tau} referencia={referenciaAsistencia} />
              </>
            }
          />
        </div>
      </section>

      {estratos.length > 0 && (
        <section className="cmv2-panel cmv2-calc-pfacultad-panel">
          <div className="cmv2-panel-head">
            <strong>Parámetros por facultad</strong>
            <span className="cmv2-pill-soft">la Propuesta 2 calcula p por facultad</span>
          </div>
          <p className="cmv2-calc-diseno-nota">
            Opcional: sobrescribe la <code>p</code> esperada de una facultad concreta. Vacío = usa la p global
            ({fmtDecimal(pF, 2)}). El motor calcula cada facultad como estrato propio con su margen y su p.
          </p>
          <div className="cmv2-table-wrap">
            <table className="cmv2-table cmv2-table--university cmv2-calc-pfacultad-tabla">
              <thead>
                <tr>
                  <th>Facultad</th>
                  <th>N facultad</th>
                  <th>p por facultad</th>
                </tr>
              </thead>
              <tbody>
                {estratos.map((est) => {
                  const committedP = safeNumber(est.p_facultad, faculty.p);
                  const valor = draftP[est.id] ?? committedP;
                  return (
                    <tr key={est.id}>
                      <td><strong>{est.label}</strong></td>
                      <td>{fmtInt(safeNumber(est.N))}</td>
                      <td>
                        <span className="cmv2-number-cell">
                          <input
                            type="number"
                            min={0.01}
                            max={0.99}
                            step={0.01}
                            value={valor}
                            aria-label={`p esperada para ${est.label}`}
                            onChange={(e) =>
                              setDraftP((prev) => ({ ...prev, [est.id]: safeNumber(e.currentTarget.value, committedP) }))
                            }
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {desactualizado && !sucio && (
        <div className="cmv2-calc-aviso" role="status">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>
            El resultado quedó desactualizado: los parámetros del diseño cambiaron. Recalcula la muestra en
            Propuestas para reflejarlos.
          </span>
          {marcoReady && (
            <button type="button" className="cmv2-primary" onClick={onCalcular} disabled={calculando}>
              {calculando ? <Loader2 size={13} className="pulso-spin" /> : <Calculator size={13} />}
              Recalcular
            </button>
          )}
        </div>
      )}

      {sucio && (
        <div className="cmv2-calc-confirm-bar" role="region" aria-label="Cambios de parámetros pendientes de confirmar">
          <div className="cmv2-calc-confirm-copy">
            <strong>{cambiosTotal.length + cambiosFaculty.length + cambiosP.length} cambio(s) sin aplicar</strong>
            <span>
              {[
                ...cambiosTotal.map((k) => `${k} (universidad)`),
                ...cambiosFaculty.map((k) => `${k} (facultades)`),
                ...(cambiosP.length ? [`p por facultad ×${cambiosP.length}`] : []),
              ].join(" · ")}
            </span>
          </div>
          <div className="cmv2-inline-actions">
            <button type="button" className="cmv2-ghost" onClick={descartar}>
              <RotateCcw size={13} aria-hidden="true" /> Descartar
            </button>
            <button type="button" className="cmv2-primary" onClick={aplicar}>
              <Check size={13} aria-hidden="true" /> Aplicar cambios
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
