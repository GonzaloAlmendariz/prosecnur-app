/**
 * Pestaña "Parámetros" de Cálculo (id calculo-guia) — el corazón matemático
 * del recorrido. Cockpit en dos columnas: a la izquierda los sliders
 * exploratorios (con "Aplicar al estudio") y el CTA "Calcular muestra";
 * a la derecha la fórmula de Cochran encadenada en 3 pasos con sustitución
 * numérica viva. El ÚNICO useMemoriaCalculo del tab alimenta fórmulas, badges
 * y la memoria de cálculo completa: preview TS instantáneo etiquetado como
 * preview, cifra definitiva del motor R etiquetada como validada.
 *
 * Nota de fidelidad: el motor aplica deff DENTRO del numerador antes del FPC
 * (n = N·z²pq·deff / ((N−1)e² + z²pq·deff)), así que la cadena se muestra en
 * ese orden — n₀ (Cochran puro) → ×deff → FPC — para que el n del paso 3 sea
 * exactamente el n teórico validado del motor.
 */
import { Calculator, Loader2 } from "lucide-react";
import type { CalcMuestraParametros } from "../../../../api/client";
import { EmptyState } from "../../../../components/States";
import { MemoriaCalculoPanel } from "../../didactica/MemoriaCalculoPanel";
import { ParametrosSliders, usePerillaParametros } from "../../didactica/ParametrosInteractivos";
import { ContextoLlano, RespaldoMetodologico } from "../../didactica/PasoDidactico";
import { calcNPreview, terminosPreview, zFromConfidence } from "../../didactica/motorPreview";
import { useMemoriaCalculo } from "../../didactica/useMemoriaCalculo";
import { fmtInt } from "../../sharedCore";
import { FormulaLatex } from "../ui";
import { SwapValor, fmtNum, ltxInt, ltxNum } from "./calculoUi";
import "../../didactica/didactica.css";
import "./calculo.css";

export function CalculoParametrosTab({
  N,
  parametros,
  metaValor,
  onAplicarParametros,
  marcoReady,
  onCalcular,
  calculando,
}: {
  N: number;
  parametros: CalcMuestraParametros;
  metaValor?: number;
  onAplicarParametros?: (patch: Partial<CalcMuestraParametros>) => void;
  marcoReady: boolean;
  onCalcular: () => void;
  calculando: boolean;
}) {
  const { activa, tocado, set, reset } = usePerillaParametros(parametros);
  const calculo = useMemoriaCalculo(
    N > 0
      ? {
          N,
          p: activa.p,
          e: activa.e,
          deff: activa.deff,
          confianza: activa.confianza,
          oversample_pct: activa.oversample,
          // Mientras se explora, la memoria muestra lo que piden los
          // parámetros (fórmula pura); la meta declarada solo aplica al
          // estado real del estudio, no a la exploración.
          meta_valor: !tocado && metaValor && metaValor > 0 ? metaValor : undefined,
          promedio_conglomerado: parametros.promedio_conglomerado,
          tau: parametros.tau,
        }
      : null,
  );

  const memoria = calculo.memoria;
  const validado = calculo.estado === "validado" && memoria != null;

  // Valores sustituidos: del motor cuando la memoria está validada, del
  // preview TS (réplica exacta) mientras tanto. El badge acompaña siempre.
  const z = validado ? memoria.parametros.z_usado : zFromConfidence(activa.confianza);
  const confianza = validado ? memoria.parametros.confianza : activa.confianza;
  const p = validado ? memoria.parametros.p : activa.p;
  const q = validado ? memoria.parametros.q : 1 - activa.p;
  const e = validado ? memoria.parametros.e : activa.e;
  const deff = validado ? memoria.parametros.deff : activa.deff;
  const nMarco = validado ? memoria.parametros.N : N;
  const nDeff = validado
    ? memoria.terminos.n0_sin_fpc
    : terminosPreview(N, activa.p, z, activa.e, activa.deff).n0SinFpc;
  const n0 = deff > 0 ? nDeff / deff : nDeff;
  const nTeorico = validado ? memoria.n_teorico : calcNPreview(N, activa.p, z, activa.e, activa.deff);
  const badge = calculo.estado;
  const conNumeros = N > 0 && Number.isFinite(n0);

  // Firmas de swap: solo cambian cuando llegan cifras VALIDADAS del motor (o
  // al perder la validación). Mientras se explora con sliders la firma queda
  // fija en "preview" — la interacción continua no gana animación por tick.
  const firmaPaso1 = validado ? `v:${Math.round(n0)}` : "preview";
  const firmaPaso2 = validado ? `v:${Math.round(nDeff)}` : "preview";
  const firmaPaso3 = validado ? `v:${nTeorico ?? "—"}` : "preview";
  const firmaMemoria = validado
    ? `v:${memoria.n_teorico ?? "—"}:${memoria.n_objetivo ?? "—"}:${memoria.n_operativo ?? "—"}`
    : "preview";

  const paso1 = conNumeros
    ? String.raw`n_0 = \dfrac{z^2\,p\,(1-p)}{e^2} = \dfrac{${ltxNum(z, 2)}^2 \times ${ltxNum(p, 2)} \times ${ltxNum(q, 2)}}{${ltxNum(e, 3)}^2} \approx ${ltxInt(Math.round(n0))}`
    : String.raw`n_0 = \dfrac{z^2\,p\,(1-p)}{e^2}`;
  const paso2 = conNumeros
    ? String.raw`n_{\mathit{deff}} = n_0 \cdot \mathit{deff} = ${ltxInt(Math.round(n0))} \times ${ltxNum(deff, 2)} \approx ${ltxInt(Math.round(nDeff))}`
    : String.raw`n_{\mathit{deff}} = n_0 \cdot \mathit{deff}`;
  const paso3 = conNumeros && nTeorico != null
    ? String.raw`n = \left\lceil \dfrac{n_{\mathit{deff}}}{1 + \frac{n_{\mathit{deff}} - 1}{N}} \right\rceil = \left\lceil \dfrac{${ltxInt(Math.round(nDeff))}}{1 + \frac{${ltxInt(Math.round(nDeff - 1))}}{${ltxInt(nMarco)}}} \right\rceil = ${ltxInt(nTeorico)}`
    : String.raw`n = \left\lceil \dfrac{n_{\mathit{deff}}}{1 + \frac{n_{\mathit{deff}} - 1}{N}} \right\rceil`;

  return (
    <div className="cmv2-calc-stack">
      <ContextoLlano paso="calculo" />
      <section className="cmv2-panel cmv2-calc-cockpit-panel">
        <div className="cmv2-panel-head">
          <div>
            <span className="cmv2-eyebrow">Parámetros del diseño</span>
            <strong>Mueve los supuestos y mira cómo respira el n</strong>
          </div>
          <span className="cmv2-pill-soft">
            {N > 0 ? `N = ${fmtInt(N)} estudiantes del marco` : "requiere marco validado"}
          </span>
        </div>
        {N > 0 ? (
          <>
            <div className="cmv2-calc-cockpit">
              <div className="cmv2-calc-cockpit-sliders">
                <ParametrosSliders
                  activa={activa}
                  tocado={tocado}
                  onSet={set}
                  onReset={reset}
                  onAplicar={onAplicarParametros}
                  calculando={calculando}
                />
                {/* Zona de disparo: hairline arriba para separar la exploración
                    (sliders + aplicar/volver) de la acción oficial del panel. */}
                <div className="cmv2-calc-cta-zona">
                  <button
                    type="button"
                    className="cmv2-primary cmv2-calc-cta"
                    onClick={onCalcular}
                    disabled={!marcoReady || calculando}
                    data-calculando={calculando || undefined}
                    aria-busy={calculando || undefined}
                  >
                    {calculando
                      ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
                      : <Calculator size={14} aria-hidden="true" />}
                    {calculando ? "Calculando…" : "Calcular muestra"}
                  </button>
                  <p className="cmv2-calc-cta-nota">
                    El cálculo oficial corre con los parámetros aplicados al estudio y
                    llena Propuestas con N, cuotas y aulas.
                  </p>
                </div>
              </div>
              <div className="cmv2-calc-cockpit-formulas cmv2-calc-cascada" aria-label="Fórmula de Cochran encadenada">
                <SwapValor firma={firmaPaso1} className="cmv2-calc-paso">
                  <FormulaLatex
                    expression={paso1}
                    badge={badge}
                    caption="Paso 1 · Cuántas encuestas pide la estadística (Cochran)"
                    terms={[
                      { symbol: "z", termino: "nivel de confianza", value: `${fmtNum(z, 2)} (${Math.round(confianza * 100)}%)` },
                      { symbol: "p", termino: "p (proporción", value: fmtNum(p, 2) },
                      { symbol: "e", termino: "margen de error", value: `±${fmtNum(e * 100, 1)}%` },
                    ]}
                  />
                </SwapValor>
                <SwapValor firma={firmaPaso2} className="cmv2-calc-paso">
                  <FormulaLatex
                    expression={paso2}
                    badge={badge}
                    caption="Paso 2 · Castigo por encuestar aulas completas"
                    terms={[{ symbol: "deff", termino: "deff", value: fmtNum(deff, 2) }]}
                  />
                </SwapValor>
                <SwapValor firma={firmaPaso3} className="cmv2-calc-paso">
                  <FormulaLatex
                    expression={paso3}
                    badge={badge}
                    caption="Paso 3 · Descuento por población finita (FPC)"
                    terms={[{ symbol: "N", termino: "FPC (corrección", value: fmtInt(nMarco) }]}
                  />
                </SwapValor>
              </div>
            </div>
            {/* MemoriaCalculoPanel vive en didactica/ (solo lectura): se envuelve
                en SwapValor para que sus KPIs fundan al validar el motor. La clase
                local solo marca la zona (hairline + aire) como disclosure al fondo. */}
            <SwapValor firma={firmaMemoria} className="cmv2-calc-memoria-zona">
              <MemoriaCalculoPanel calculo={calculo} />
            </SwapValor>
          </>
        ) : (
          <EmptyState
            icon={<Calculator size={20} />}
            title="El cálculo aparece cuando el marco tiene población"
            hint="Construye y valida el marco en las secciones anteriores; con N conocido, los sliders y la fórmula cobran vida."
          />
        )}
      </section>
      <RespaldoMetodologico paso="calculo" />
    </div>
  );
}
