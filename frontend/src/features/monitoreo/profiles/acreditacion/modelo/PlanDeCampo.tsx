import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { apiMonitoreoConfig, type MonitoreoConfig, type MonitoreoReportWeekday, type MonitoreoState } from "../../../../../api/client";
import {
  acreditacionScheduleDraftFromPhases,
  positiveInteger,
  upsertAcreditacionFieldSchedulePhase,
  type AcreditacionFieldScheduleDraft,
} from "../../telefonico/modelo/calendarioModel";
import { CALENDAR_REPORT_WEEKDAYS } from "../avance/ritmoDiario";
import { fechaCorta } from "../avance/graficosDeAvance";
import { CabeceraDeTarjeta } from "../navegacion/rotuloDePestana";
import { fmt } from "../formato";
import type { ModeloDeVentana } from "./ventanaModelo";
import "./planDeCampo.css";

type Aviso = { tono: "ok" | "error" | "info"; texto: string } | null;

function semanas(n: number) {
  return `${fmt(n)} ${n === 1 ? "semana" : "semanas"}`;
}

/** «25 may a 22 jul», o lo que falte dicho en palabras. */
function rango(desde: string, hasta: string) {
  if (!desde && !hasta) return "Sin fechas";
  return `${desde ? fechaCorta(desde) : "inicio sin fecha"} a ${hasta ? fechaCorta(hasta) : "fin sin fecha"}`;
}

/**
 * Modelo › Ventana de campo, debajo de la ventana de cada público: el plan
 * declarado frente a lo que el corte muestra que ocurrió, y el formulario para
 * declararlo. Reemplaza al bloque «Plan y ejecución de campo» del workbench
 * anterior, que repetía la duración en dos fichas y mostraba fechas ISO.
 *
 * Lo ejecutado sale de la misma ventana que pinta la tarjeta de arriba
 * (`construirVentana`), así que las dos cuentan los mismos días.
 */
export function PlanDeCampo({
  config,
  ventana,
  onStateChange,
}: {
  config: MonitoreoConfig | null;
  ventana: ModeloDeVentana;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const fases = config?.strategy_phases;
  const [borrador, setBorrador] = useState<AcreditacionFieldScheduleDraft>(() => acreditacionScheduleDraftFromPhases(fases ?? []));
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  useEffect(() => {
    setBorrador(acreditacionScheduleDraftFromPhases(fases ?? []));
  }, [fases]);

  if (!config) return null;

  const cambiar = (parche: Partial<AcreditacionFieldScheduleDraft>) => {
    setBorrador((actual) => ({ ...actual, ...parche }));
    setAviso(null);
  };

  const guardar = async () => {
    setGuardando(true);
    setAviso({ tono: "info", texto: "Guardando el plan…" });
    try {
      const resultado = await apiMonitoreoConfig({ ...config, strategy_phases: upsertAcreditacionFieldSchedulePhase(config.strategy_phases ?? [], borrador) });
      onStateChange?.(resultado.state);
      setBorrador(acreditacionScheduleDraftFromPhases(resultado.config.strategy_phases ?? []));
      setAviso({ tono: "ok", texto: "Plan guardado." });
    } catch (error) {
      setAviso({ tono: "error", texto: (error as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  const semanasEjecutadas = ventana.diasDelCampo ? Math.ceil(ventana.diasDelCampo / 7) : 0;
  const hayEjecucion = Boolean(ventana.desde && ventana.hasta);
  const fueraDelPlan = hayEjecucion && semanasEjecutadas > borrador.durationWeeks;
  const finSemana = borrador.startWeek + borrador.durationWeeks - 1;

  return (
    <section className="acr-av-panel acr-plan" aria-label="Plan de campo">
      <CabeceraDeTarjeta>
        <h3>Plan de campo <span className="acr-av-tenue">Lo declarado frente a lo que muestra el corte</span></h3>
        <button type="button" className="acr-av-boton" onClick={() => { void guardar(); }} disabled={guardando}>
          {guardando ? <Loader2 size={13} className="pulso-spin" aria-hidden="true" /> : <Save size={13} aria-hidden="true" />}
          Guardar plan
        </button>
      </CabeceraDeTarjeta>
      <div className="acr-plan-cuerpo">
        <dl className="acr-plan-comparacion" data-qa-geometry-group="acreditacion-plan-comparacion" data-qa-geometry-contract="equal">
          <div data-qa-geometry-member>
            <dt>Plan</dt>
            <dd className="acr-av-num">{borrador.durationWeeks === 1 ? `Semana ${fmt(borrador.startWeek)}` : `Semanas ${fmt(borrador.startWeek)} a ${fmt(finSemana)}`}</dd>
            <small>{rango(borrador.startDate, borrador.endDate)} · {semanas(borrador.durationWeeks)}</small>
          </div>
          <div data-qa-geometry-member>
            <dt>Ejecutado</dt>
            <dd className="acr-av-num">{hayEjecucion ? rango(ventana.desde ?? "", ventana.hasta ?? "") : "Sin respuestas"}</dd>
            <small>{hayEjecucion ? `${semanas(semanasEjecutadas)} · ${fmt(ventana.diasConEfectivas)} días con efectivas` : "Aparece con las primeras respuestas con fecha"}</small>
          </div>
          <div data-qa-geometry-member className={fueraDelPlan ? "is-alerta" : hayEjecucion ? "is-ok" : undefined}>
            <dt>Lectura</dt>
            <dd>{!hayEjecucion ? "Sin comparar" : fueraDelPlan ? "Fuera del plan" : "Dentro del plan"}</dd>
            <small>
              {!hayEjecucion
                ? "Falta el campo ejecutado"
                : fueraDelPlan
                  ? `El campo lleva ${semanas(semanasEjecutadas)} y el plan declara ${semanas(borrador.durationWeeks)}`
                  : `Cabe en las ${semanas(borrador.durationWeeks)} declaradas`}
            </small>
          </div>
        </dl>
        <div className="acr-plan-formulario" role="group" aria-label="Declarar el plan">
          <label>
            <span>Inicio del campo</span>
            <input type="date" value={borrador.startDate} disabled={guardando} onChange={(evento) => cambiar({ startDate: evento.currentTarget.value })} />
          </label>
          <label>
            <span>Fin del campo</span>
            <input type="date" min={borrador.startDate || undefined} value={borrador.endDate} disabled={guardando} onChange={(evento) => cambiar({ endDate: evento.currentTarget.value })} />
          </label>
          <label>
            <span>Semana de inicio</span>
            <input type="number" min={1} value={borrador.startWeek} disabled={guardando} onChange={(evento) => cambiar({ startWeek: positiveInteger(evento.currentTarget.value, 1) })} />
          </label>
          <label>
            <span>Duración en semanas</span>
            <input type="number" min={1} value={borrador.durationWeeks} disabled={guardando} onChange={(evento) => cambiar({ durationWeeks: positiveInteger(evento.currentTarget.value, 1) })} />
          </label>
          <label>
            <span>Día del reporte</span>
            <select value={borrador.reportWeekday} disabled={guardando} onChange={(evento) => cambiar({ reportWeekday: evento.currentTarget.value as MonitoreoReportWeekday | "" })}>
              <option value="">Sin día</option>
              {CALENDAR_REPORT_WEEKDAYS.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}
            </select>
          </label>
        </div>
        {aviso ? <p className={`acr-plan-aviso is-${aviso.tono}`} role="status">{aviso.texto}</p> : null}
      </div>
    </section>
  );
}
