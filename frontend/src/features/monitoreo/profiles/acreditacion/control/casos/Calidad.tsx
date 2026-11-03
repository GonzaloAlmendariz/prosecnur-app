import { useMemo } from "react";
import { EstadoChip } from "../../../../../../components/EstadoChip";
import { CheckCircle2 } from "lucide-react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../../api/client";
import { fmt } from "../../formato";
import { filasDeHoja } from "../../../telefonico/navegacion/bloques";
import { buildAcreditacionPhoneRealAlertModel, type AcreditacionQualityAlertItem } from "../../AcreditacionPhoneAlerts";
import { conSuRespuesta, duracionesFueraDeRango, duracionLegible, type DuracionFueraDeRango } from "./calidadModelo";
import { useResumenDelCorte } from "../../navegacion/resumenDelCorte";
import { clasePublico, paletaDePublicos } from "../../paletaPublicos";
import "../../paletaPublicos.css";
import "../../avance/avance.css";
import "./cruce.css";
import "./personas.css";
import "./calidad.css";
import { CabeceraDeTarjeta } from "../../navegacion/rotuloDePestana";
import { VacioDeBloque } from "../../piezas/AvisoDeTarjeta";

const SIN_RESPUESTAS: never[] = [];

/** Cómo va la unión de cada duración con su respuesta (la bandeja llega con el corte de Control). */
export type UnionConRespuestas = "uniendo" | "unida" | "fallo";

type PropsDeVista = {
  duraciones: DuracionFueraDeRango[];
  /** Sin la bandeja, Público y Estado no se conocen todavía: no se pintan como vacíos. */
  union?: UnionConRespuestas;
  minimo: number;
  maximo: number;
  senales: AcreditacionQualityAlertItem[];
};

export function CalidadVista({ duraciones, minimo, maximo, senales, union = "unida" }: PropsDeVista) {
  // Regla de Gonzalo: el control de tiempo vigila las encuestas CORTAS. Las que
  // pasan del máximo no son un problema: quedan como dato neutro, fuera de lo
  // que se revisa.
  const cortas = duraciones.filter((item) => item.tipo === "corta");
  const largas = duraciones.length - cortas.length;
  const paleta = paletaDePublicos(cortas.map((item) => item.publico ?? "").filter(Boolean));
  // Un «—» mudo decía «no tiene público»; lo cierto es «todavía no se sabe» o «no cruzó».
  const sinDato = union === "uniendo" ? "Uniendo…" : "Sin dato";
  return (
    <div className="acr-ps is-calidad" data-qa-geometry-group="acreditacion-control-calidad" data-qa-geometry-contract="intrinsic">
      <section className="acr-av-panel acr-ps-tabla" aria-label="Respuestas demasiado cortas">
        <CabeceraDeTarjeta primera>
          <h3>Respuestas demasiado cortas <span className="acr-av-tenue">{`Se revisan las de menos de ${duracionLegible(minimo)}`}</span></h3>
        </CabeceraDeTarjeta>
        {union === "uniendo" && cortas.length ? <p className="acr-cal-union" role="status">Uniendo cada respuesta con su público y su estado.</p> : null}
        {union === "fallo" && cortas.length ? <p className="acr-cal-union is-fallo" role="status">No llegó la bandeja de respuestas: el público y el estado no se pudieron unir. Actualiza el corte para reintentar.</p> : null}
        <div className="acr-cl-cifras is-dos" data-qa-geometry-group="acreditacion-calidad-cifras" data-qa-geometry-contract="equal">
          <div className="acr-res-kpi" data-qa-geometry-member><small>{`Menos de ${duracionLegible(minimo)}`}</small><b className="acr-av-num">{fmt(cortas.length)}</b></div>
          <div className="acr-res-kpi is-neutra" data-qa-geometry-member><small>{`Más de ${duracionLegible(maximo)}, no se revisan`}</small><b className="acr-av-num">{fmt(largas)}</b></div>
        </div>
        <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
          {cortas.length ? (
            <table className="acr-pub-tabla">
              <thead>
                <tr>
                  <th scope="col">Respuesta</th>
                  <th scope="col">Público</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="is-num">Duración</th>
                  <th scope="col">Lectura</th>
                </tr>
              </thead>
              <tbody>
                {cortas.map((item) => (
                  <tr key={`${item.id}-${item.segundos}`}>
                    <th scope="row" className="acr-av-num">{item.respuesta || item.id}</th>
                    <td>{item.publico ? <span className={`acr-celda-publico ${clasePublico(paleta, item.publico)}`}><i className="mon-publico-punto" aria-hidden="true" />{item.publico}</span> : <span className="acr-av-tenue">{sinDato}</span>}</td>
                    <td>{item.estado || <span className="acr-av-tenue">{sinDato}</span>}</td>
                    <td className="is-num">{duracionLegible(item.segundos)}</td>
                    <td><EstadoChip label="Muy corta" tone="warn" /></td>
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
        ) : <VacioDeBloque icono={<CheckCircle2 size={15} />} titulo="Sin señales de consistencia en este corte." />}
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
  // La bandeja llega con el corte de Control (queries_summary) y queda en el resumen del corte.
  const respuestasConFila = useResumenDelCorte((estado) => estado.respuestasConFila);
  const casosFallaron = useResumenDelCorte((estado) => estado.casosFallaron);
  const casos = respuestasConFila ?? SIN_RESPUESTAS;
  const union: UnionConRespuestas = respuestasConFila ? "unida" : casosFallaron ? "fallo" : "uniendo";
  const duraciones = useMemo(
    () => conSuRespuesta(duracionesFueraDeRango(inconsistencias ?? [], minimo, maximo), casos),
    [inconsistencias, minimo, maximo, casos],
  );
  const senales = useMemo(
    () => buildAcreditacionPhoneRealAlertModel({ alertRows: filasDeHoja(reports, "alertas", ["alertas"]) }).activeAlerts,
    [reports],
  );
  return <CalidadVista duraciones={duraciones} minimo={minimo} maximo={maximo} senales={senales} union={union} />;
}
