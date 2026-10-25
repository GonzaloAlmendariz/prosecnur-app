import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "../../../../../vendor/lucide-react";
import type { MonitoreoAcreditacionReports, MonitoreoReportWeekday, MonitoreoState } from "../../../../../api/client";
import { apiMonitoreoConfig } from "../../../../../api/monitoreo";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { CALENDAR_REPORT_WEEKDAYS, calendarReportWeekdayLabel } from "../avance/ritmoDiario";
import { notaDeLaSerie } from "../avance/ritmoModel";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import {
  acreditacionScheduleDraftFromPhases,
  diasDeCampo,
  lecturaDelCronograma,
  positiveInteger,
  upsertAcreditacionFieldSchedulePhase,
  type AcreditacionFieldScheduleDraft,
} from "./calendarioModel";
import "../control/controlTelefonico.css";
import "../insumos/insumosTelefonico.css";
import "./modeloTelefonico.css";

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

type Estado = { tono: "info" | "exito" | "error"; texto: string } | null;

/**
 * Modelo › Cuotas y calendario › Calendario (`panel=calendario`). Se edita lo
 * mismo que en la vista anterior —semana de inicio, cuántas semanas, fechas
 * opcionales y día del reporte de avance— y se guarda igual
 * (`strategy_phases`). Lo nuevo es la forma (§2a-bis): el rótulo de la pestaña
 * y el selector Cuotas | Calendario encabezan la primera tarjeta, y los días de
 * campo leen la misma serie que Ritmo y el calendario de Cuotas.
 */
export function Calendario({
  state,
  reports,
  onStateChange,
}: {
  state: MonitoreoState | null;
  reports: MonitoreoAcreditacionReports | null;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const config = state?.config ?? null;
  const fases = config?.strategy_phases;
  const [draft, setDraft] = useState<AcreditacionFieldScheduleDraft>(() => acreditacionScheduleDraftFromPhases(fases ?? []));
  const [guardando, setGuardando] = useState(false);
  const [estado, setEstado] = useState<Estado>(null);
  useEffect(() => {
    setDraft(acreditacionScheduleDraftFromPhases(fases ?? []));
  }, [fases]);

  const reglas = config?.operational_model?.state_rules;
  const campo = useMemo(() => diasDeCampo(reports, reglas ?? []), [reports, reglas]);
  const nota = useMemo(() => notaDeLaSerie(reports), [reports]);
  const lectura = lecturaDelCronograma(draft);
  const guardado = acreditacionScheduleDraftFromPhases(fases ?? []);
  const cambiado = JSON.stringify(guardado) !== JSON.stringify(draft);
  const cambiar = (patch: Partial<AcreditacionFieldScheduleDraft>) => {
    setDraft((actual) => ({ ...actual, ...patch }));
    setEstado(null);
  };

  const guardar = async () => {
    if (!config) return;
    setGuardando(true);
    setEstado({ tono: "info", texto: "Guardando el cronograma…" });
    try {
      const result = await apiMonitoreoConfig({
        ...config,
        strategy_phases: upsertAcreditacionFieldSchedulePhase(config.strategy_phases ?? [], draft),
      });
      onStateChange?.(result.state);
      setDraft(acreditacionScheduleDraftFromPhases(result.config.strategy_phases ?? []));
      setEstado({ tono: "exito", texto: "Cronograma guardado." });
    } catch (error) {
      setEstado({ tono: "error", texto: (error as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mon-calendario" data-qa-geometry-group="telefonico-modelo-calendario" data-qa-geometry-contract="intrinsic">
      <div className="mon-calendario-columna">
        <section className="mon-ctl-panel mon-calendario-cronograma" aria-label="Cronograma de campo">
          {/* §2a-bis: el rótulo y el selector Cuotas | Calendario encabezan la primera tarjeta. */}
          <header className="mon-ctl-panel-cabecera mon-calendario-cabecera">
            <RotuloDePestana />
            <b>Cronograma de campo</b>
            <button
              type="button"
              className="mon-insumos-boton is-primario mon-calendario-guardar"
              disabled={!config || guardando || !cambiado}
              onClick={() => { void guardar(); }}
            >
              {guardando ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
              <span>{guardando ? "Guardando…" : "Guardar cronograma"}</span>
            </button>
          </header>
          {config ? (
            <>
              <div className="mon-calendario-formulario">
                <label className="mon-calendario-campo">
                  <span className="mon-ctl-antetitulo">Semana de inicio</span>
                  <input
                    type="number"
                    min={1}
                    value={draft.startWeek}
                    disabled={guardando}
                    onChange={(event) => cambiar({ startWeek: positiveInteger(event.currentTarget.value, 1) })}
                  />
                </label>
                <label className="mon-calendario-campo">
                  <span className="mon-ctl-antetitulo">Semanas de campo</span>
                  <input
                    type="number"
                    min={1}
                    value={draft.durationWeeks}
                    disabled={guardando}
                    onChange={(event) => cambiar({ durationWeeks: positiveInteger(event.currentTarget.value, 1) })}
                  />
                </label>
                <label className="mon-calendario-campo">
                  <span className="mon-ctl-antetitulo">Inicio del campo</span>
                  <input type="date" value={draft.startDate} disabled={guardando} onChange={(event) => cambiar({ startDate: event.currentTarget.value })} />
                </label>
                <label className="mon-calendario-campo">
                  <span className="mon-ctl-antetitulo">Fin del campo</span>
                  <input
                    type="date"
                    min={draft.startDate || undefined}
                    value={draft.endDate}
                    disabled={guardando}
                    onChange={(event) => cambiar({ endDate: event.currentTarget.value })}
                  />
                </label>
                <label className="mon-calendario-campo">
                  <span className="mon-ctl-antetitulo">Reporte de avance</span>
                  <select
                    value={draft.reportWeekday}
                    disabled={guardando}
                    onChange={(event) => cambiar({ reportWeekday: event.currentTarget.value as MonitoreoReportWeekday | "" })}
                  >
                    <option value="">Sin día</option>
                    {CALENDAR_REPORT_WEEKDAYS.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}
                  </select>
                </label>
              </div>
              <dl className="mon-calendario-lectura">
                <div><dt>Ventana</dt><dd>{lectura.ventana}</dd><span>{lectura.duracion}</span></div>
                <div>
                  <dt>Fechas</dt>
                  <dd className={lectura.fechas ? undefined : "is-tenue"}>{lectura.fechas ?? "Sin fechas"}</dd>
                  <span>{lectura.fechas ? "declaradas" : "son opcionales"}</span>
                </div>
                <div>
                  <dt>Reporte</dt>
                  <dd className={draft.reportWeekday ? undefined : "is-tenue"}>{calendarReportWeekdayLabel(draft.reportWeekday)}</dd>
                  <span>{draft.reportWeekday ? "cada semana" : "elige el día arriba"}</span>
                </div>
              </dl>
              {estado ? (
                <NotaDelModo estado tono={estado.tono} className="mon-calendario-estado">{estado.texto}</NotaDelModo>
              ) : cambiado ? (
                <NotaDelModo tono="aviso" className="mon-calendario-estado">Hay cambios sin guardar.</NotaDelModo>
              ) : null}
            </>
          ) : (
            <NotaDelModo tono="neutro" className="mon-calendario-estado">
              La configuración del proyecto todavía no está disponible para editar el cronograma.
            </NotaDelModo>
          )}
        </section>

        <section className="mon-ctl-panel mon-calendario-dias" aria-label="Días de campo del corte" data-qa-geometry-capacity="owned">
          <header className="mon-ctl-panel-cabecera">
            <b>Días de campo del corte</b>
            <span>
              {campo.desde && campo.hasta
                ? `${campo.desde} a ${campo.hasta}, ${n(campo.diasConEfectivas)} ${campo.diasConEfectivas === 1 ? "día" : "días"} con efectivas`
                : "sin efectivas fechadas"}
            </span>
          </header>
          {campo.dias.length ? (
            <div className="mon-ctl-tabla-marco">
              <table className="mon-ctl-tabla mon-calendario-tabla">
                <thead>
                  <tr>
                    <th scope="col">Día</th>
                    <th scope="col">Efectivas de Kobo</th>
                    <th scope="col" className="is-num">Acumulado</th>
                    <th scope="col" className="is-num">Llamados en la hoja</th>
                  </tr>
                </thead>
                <tbody>
                  {campo.dias.map((dia) => (
                    <tr key={dia.fecha}>
                      <th scope="row" className="is-num">{dia.etiqueta}</th>
                      <td className="mon-calendario-barra">
                        <i aria-hidden="true"><b style={{ width: `${(dia.kobo / campo.maximo) * 100}%` }} /></i>
                        <span className="is-num">{n(dia.kobo)}</span>
                      </td>
                      <td className="is-num">{n(dia.acumulado)}</td>
                      <td className={`is-num${dia.llamados ? "" : " is-tenue"}`}>{dia.llamados ? n(dia.llamados) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            // C3: el vacío es de esta tarjeta y dice por qué.
            <p className="mon-calendario-vacio">
              El corte no trae efectivas de Kobo con fecha ni llamados fechados en la hoja de barrido: los días aparecen al actualizar
              con el campo en marcha.
            </p>
          )}
          {nota ? <NotaDelModo tono="aviso" className="mon-calendario-estado">{nota}.</NotaDelModo> : null}
        </section>
      </div>

      <aside className="mon-calendario-lateral">
        <section className="mon-ctl-panel mon-insumos-tarjeta mon-calendario-ritmo" aria-label="Ritmo observado">
          <span className="mon-ctl-antetitulo">Ritmo observado</span>
          {campo.promedio != null ? (
            <>
              <p className="mon-calendario-cifra">
                <strong className="is-num">{campo.promedio.toLocaleString("es-PE", { maximumFractionDigits: 1 })}</strong>
                <span>efectivas por día</span>
              </p>
              <dl className="mon-calendario-datos">
                <div><dt>Efectivas en la serie</dt><dd className="is-num">{n(campo.total)}</dd></div>
                <div><dt>Días con efectivas</dt><dd className="is-num">{n(campo.diasConEfectivas)}</dd></div>
                {campo.pico ? <div><dt>Mejor día</dt><dd className="is-num">{n(campo.pico.casos)} el {campo.pico.etiqueta}</dd></div> : null}
                {campo.sinFecha ? <div><dt>Efectivas sin fecha</dt><dd className="is-num">{n(campo.sinFecha)}</dd></div> : null}
                <div><dt>La hoja registra hasta</dt><dd className="is-num">{campo.hojaHasta ?? "—"}</dd></div>
              </dl>
            </>
          ) : (
            <p>Sin efectivas de Kobo fechadas en este corte: el ritmo se calcula cuando lleguen.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
