/**
 * Memoria de cálculo visible: cifras clave con procedencia, retrocálculo del
 * margen real, decision log paso a paso y fuentes. Es la materialización de
 * "estrictamente validado": todo lo que se muestra sale del motor R.
 */
import type { CalcMuestraMemoria } from "../../../api/client";
import { BadgeMotor } from "./PasoDidactico";
import type { MemoriaCalculo } from "./useMemoriaCalculo";

const fmtInt = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : Math.round(value).toLocaleString("es-PE");

const fmtPct = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? "—" : `±${(value * 100).toLocaleString("es-PE", { maximumFractionDigits: digits })}%`;

export function MemoriaCalculoPanel({ calculo }: { calculo: MemoriaCalculo }) {
  const { estado, memoria, preview } = calculo;
  const usaMotor = estado === "validado" && memoria != null;
  const nTeorico = usaMotor ? memoria.n_teorico : preview.nTeorico;
  const nObjetivo = usaMotor ? memoria.n_objetivo : preview.nObjetivo;
  const nOperativo = usaMotor ? memoria.n_operativo : preview.nOperativo;
  const sobremuestra = usaMotor ? memoria.sobremuestra : preview.sobremuestra;
  const precision = usaMotor ? memoria.retrocalculo.precision_alcanzada : preview.precision;
  const eObjetivo = usaMotor ? memoria.retrocalculo.e_objetivo : null;
  const cumple = usaMotor ? memoria.retrocalculo.cumple : null;

  return (
    <div className="cmv2-did-result">
      <div className="cmv2-did-result-head">
        <span className="cmv2-eyebrow">Memoria de cálculo</span>
        <BadgeMotor estado={estado} />
      </div>
      <dl className="cmv2-did-kpis">
        <div className="cmv2-did-kpi">
          <dt>n teórico</dt>
          <dd>{fmtInt(nTeorico)}</dd>
          <span className="cmv2-did-kpi-hint">lo que pide la fórmula</span>
        </div>
        <div className="cmv2-did-kpi" data-hero="true">
          <dt>n objetivo</dt>
          <dd>{fmtInt(nObjetivo)}</dd>
          <span className="cmv2-did-kpi-hint">encuestas válidas a lograr</span>
        </div>
        <div className="cmv2-did-kpi">
          <dt>sobremuestra</dt>
          <dd>{sobremuestra ? `+${fmtInt(sobremuestra)}` : "—"}</dd>
          <span className="cmv2-did-kpi-hint">colchón operativo</span>
        </div>
        <div className="cmv2-did-kpi">
          <dt>n operativo</dt>
          <dd>{fmtInt(nOperativo)}</dd>
          <span className="cmv2-did-kpi-hint">lo que se lleva a campo</span>
        </div>
        {memoria?.unidades_operativas != null && (
          <div className="cmv2-did-kpi">
            <dt>cursos-horario estimados</dt>
            <dd>{fmtInt(memoria.unidades_operativas)}</dd>
            <span className="cmv2-did-kpi-hint">según rendimiento por curso-horario</span>
          </div>
        )}
      </dl>
      <div className="cmv2-did-retro" data-cumple={cumple == null ? undefined : String(cumple)}>
        {cumple == null ? (
          <span>
            Margen de error estimado con este n: <strong>{fmtPct(precision)}</strong> (pendiente de validación de la calculadora).
          </span>
        ) : (
          <span>
            Verificación inversa de la calculadora: con n = <strong>{fmtInt(nObjetivo)}</strong> el margen real es{" "}
            <strong>{fmtPct(precision)}</strong> frente al objetivo de <strong>{fmtPct(eObjetivo)}</strong> —{" "}
            {cumple ? "el diseño cumple lo prometido." : "el diseño no llega al objetivo; ajusta parámetros."}
          </span>
        )}
      </div>
      {usaMotor && memoria.decision_log.length > 0 && (
        <ol className="cmv2-did-log">
          {memoria.decision_log.map((entrada, i) => (
            <li key={`${entrada.paso}-${i}`}>
              <div className="cmv2-did-log-decision">{entrada.decision}</div>
              <div className="cmv2-did-log-motivo">{entrada.motivo}</div>
              <span className="cmv2-did-log-fuente">{entrada.fuente}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export type { CalcMuestraMemoria };
