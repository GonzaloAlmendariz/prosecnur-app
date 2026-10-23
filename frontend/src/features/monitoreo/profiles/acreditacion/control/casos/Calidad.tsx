import { useMemo } from "react";
import { Alert } from "../../../../../../components/Alert";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../../api/client";
import { fmt } from "../../formato";
import { filasDeHoja } from "../../../telefonico/navegacion/bloques";
import { buildAcreditacionPhoneRealAlertModel, type AcreditacionQualityAlertItem } from "../../AcreditacionPhoneAlerts";
import { duracionesFueraDeRango, duracionLegible, type DuracionFueraDeRango } from "./calidadModelo";
import "../../avance/avance.css";
import "./cruce.css";
import "./personas.css";
import "./calidad.css";

type PropsDeVista = {
  duraciones: DuracionFueraDeRango[];
  minimo: number;
  maximo: number;
  senales: AcreditacionQualityAlertItem[];
};

export function CalidadVista({ duraciones, minimo, maximo, senales }: PropsDeVista) {
  const cortas = duraciones.filter((item) => item.tipo === "corta").length;
  const largas = duraciones.length - cortas;
  return (
    <div className="acr-ps is-calidad" data-qa-geometry-group="acreditacion-control-calidad" data-qa-geometry-contract="intrinsic">
      <section className="acr-av-panel acr-ps-tabla" aria-label="Duraciones fuera de rango">
        <header className="acr-av-panel-cabecera">
          <h3>Duraciones fuera de rango <span className="acr-av-tenue">{`Rango aceptado de ${duracionLegible(minimo)} a ${duracionLegible(maximo)}`}</span></h3>
        </header>
        <div className="acr-cl-cifras" data-qa-geometry-group="acreditacion-calidad-cifras" data-qa-geometry-contract="equal">
          <div className="acr-res-kpi" data-qa-geometry-member><small>Fuera de rango</small><b className="acr-av-num">{fmt(duraciones.length)}</b></div>
          <div className="acr-res-kpi" data-qa-geometry-member><small>{`Menos de ${duracionLegible(minimo)}`}</small><b className="acr-av-num">{fmt(cortas)}</b></div>
          <div className="acr-res-kpi" data-qa-geometry-member><small>{`Más de ${duracionLegible(maximo)}`}</small><b className="acr-av-num">{fmt(largas)}</b></div>
        </div>
        <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
          {duraciones.length ? (
            <table className="acr-pub-tabla">
              <thead>
                <tr>
                  <th scope="col">Respuesta</th>
                  <th scope="col" className="is-num">Duración</th>
                  <th scope="col">Lectura</th>
                </tr>
              </thead>
              <tbody>
                {duraciones.map((item) => (
                  <tr key={`${item.id}-${item.segundos}`}>
                    <th scope="row" className="acr-av-num">{item.id}</th>
                    <td className="is-num">{duracionLegible(item.segundos)}</td>
                    <td><span className={`acr-av-chip${item.tipo === "corta" ? " is-falta" : ""}`}>{item.tipo === "corta" ? "Muy corta" : "Muy larga"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="acr-pr-cola-vacia" data-vacio><Alert kind="info">Ninguna respuesta sale del rango de duración.</Alert></div>}
        </div>
      </section>
      <section className="acr-av-panel acr-ps-respondieron" aria-label="Señales de consistencia">
        <header className="acr-av-panel-cabecera"><h3>Señales de consistencia</h3></header>
        {senales.length ? (
          <ul className="acr-cl-senales" data-qa-geometry-capacity="owned">
            {senales.map((senal) => (
              <li key={senal.id} className={`is-${senal.tone}`}>
                <p className="acr-cl-senal">
                  <span className="acr-res-punto" aria-hidden="true" />
                  <b>{senal.title}</b>
                  {senal.count != null ? <b className="acr-av-num">{fmt(senal.count)}</b> : null}
                </p>
                {senal.where ? <span className="acr-av-tenue">{senal.where}</span> : null}
                {senal.detail ? <span className="acr-cl-detalle">{senal.detail}</span> : null}
              </li>
            ))}
          </ul>
        ) : <div className="acr-ct-cuerpo"><Alert kind="info">La hoja de alertas no trae señales activas.</Alert></div>}
      </section>
    </div>
  );
}

/**
 * Control › Calidad (ficha Ctl7): duraciones fuera del rango del proyecto,
 * cada una con su valor, y las señales de consistencia de la hoja de alertas.
 * La supervisión por rellamada sigue como sub-vista hasta que se decida P3.
 */
export function Calidad({ reports, state }: { reports: MonitoreoAcreditacionReports; state: MonitoreoState | null | undefined }) {
  const minimo = state?.config?.min_duration_seconds ?? 60;
  const maximo = state?.config?.max_duration_seconds ?? 7200;
  const inconsistencias = state?.dashboard?.inconsistencies;
  const duraciones = useMemo(() => duracionesFueraDeRango(inconsistencias ?? [], minimo, maximo), [inconsistencias, minimo, maximo]);
  const senales = useMemo(
    () => buildAcreditacionPhoneRealAlertModel({ alertRows: filasDeHoja(reports, "alertas", ["alertas"]) }).activeAlerts,
    [reports],
  );
  return <CalidadVista duraciones={duraciones} minimo={minimo} maximo={maximo} senales={senales} />;
}
