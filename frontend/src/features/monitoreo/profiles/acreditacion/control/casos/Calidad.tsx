import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../../api/client";
import { fmt } from "../../formato";
import { filasDeHoja } from "../../../telefonico/navegacion/bloques";
import { buildAcreditacionPhoneRealAlertModel, type AcreditacionQualityAlertItem } from "../../AcreditacionPhoneAlerts";
import { duracionesFueraDeRango, duracionLegible, type DuracionFueraDeRango } from "./calidadModelo";
import "../../avance/avance.css";
import "./cruce.css";
import "./personas.css";
import "./calidad.css";
import { CabeceraDeTarjeta } from "../../navegacion/rotuloDePestana";
import { VacioDeBloque } from "../../piezas/AvisoDeTarjeta";

type PropsDeVista = {
  duraciones: DuracionFueraDeRango[];
  minimo: number;
  maximo: number;
  senales: AcreditacionQualityAlertItem[];
};

export function CalidadVista({ duraciones, minimo, maximo, senales }: PropsDeVista) {
  // Regla de Gonzalo: el control de tiempo vigila las encuestas CORTAS. Las que
  // pasan del máximo no son un problema: quedan como dato neutro, fuera de lo
  // que se revisa.
  const cortas = duraciones.filter((item) => item.tipo === "corta");
  const largas = duraciones.length - cortas.length;
  return (
    <div className="acr-ps is-calidad" data-qa-geometry-group="acreditacion-control-calidad" data-qa-geometry-contract="intrinsic">
      <section className="acr-av-panel acr-ps-tabla" aria-label="Respuestas demasiado cortas">
        <CabeceraDeTarjeta primera>
          <h3>Respuestas demasiado cortas <span className="acr-av-tenue">{`Se revisan las de menos de ${duracionLegible(minimo)}`}</span></h3>
        </CabeceraDeTarjeta>
        <div className="acr-cl-cifras is-dos" data-qa-geometry-group="acreditacion-calidad-cifras" data-qa-geometry-contract="equal">
          <div className="acr-res-kpi" data-qa-geometry-member><small>{`A revisar: menos de ${duracionLegible(minimo)}`}</small><b className="acr-av-num">{fmt(cortas.length)}</b></div>
          <div className="acr-res-kpi is-neutra" data-qa-geometry-member><small>{`Más de ${duracionLegible(maximo)}, no se revisan`}</small><b className="acr-av-num">{fmt(largas)}</b></div>
        </div>
        <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
          {cortas.length ? (
            <table className="acr-pub-tabla">
              <thead>
                <tr>
                  <th scope="col">Respuesta</th>
                  <th scope="col" className="is-num">Duración</th>
                  <th scope="col">Lectura</th>
                </tr>
              </thead>
              <tbody>
                {cortas.map((item) => (
                  <tr key={`${item.id}-${item.segundos}`}>
                    <th scope="row" className="acr-av-num">{item.id}</th>
                    <td className="is-num">{duracionLegible(item.segundos)}</td>
                    <td><span className="acr-av-chip is-falta">Muy corta</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <VacioDeBloque icono={<CheckCircle2 size={15} />} titulo={`Ninguna respuesta dura menos de ${duracionLegible(minimo)}.`} descripcion="El umbral se edita en Insumos › Reglas." />}
        </div>
      </section>
      <section className="acr-av-panel acr-ps-respondieron" aria-label="Señales de consistencia" data-qa-geometry-capacity="owned">
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
        ) : <VacioDeBloque icono={<CheckCircle2 size={15} />} titulo="La hoja de alertas no trae señales activas." />}
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
