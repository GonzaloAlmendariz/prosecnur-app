import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { fmt } from "../formato";
import { fechaCorta } from "../avance/graficosDeAvance";
import { posicion, type ModeloDeVentana } from "./ventanaModelo";
import { CabeceraDeTarjeta } from "../navegacion/rotuloDePestana";
import "../avance/avance.css";
import "./modelo.css";
import { VacioDeBloque } from "../piezas/AvisoDeTarjeta";

function Banda({ desde, hasta, inicio, total, clase }: { desde: string; hasta: string; inicio: string; total: number; clase: string }) {
  const izquierda = posicion(desde, inicio, total);
  const ancho = Math.max(0.8, posicion(hasta, inicio, total) - izquierda);
  return <span className={`acr-mo-banda ${clase}`} style={{ left: `${izquierda}%`, width: `${ancho}%` }} />;
}

/**
 * Modelo › Ventana de campo (ficha M3): cuándo entra cada público. Las cifras
 * del campo, el plan declarado y la ventana real de cada público con su
 * intensidad diaria; debajo, el plan de campo (`PlanDeCampo`).
 */
export function VentanaDeCampo({ modelo, editorDelPlan }: { modelo: ModeloDeVentana; editorDelPlan?: ReactNode }) {
  const { desde, hasta, diasDelCampo } = modelo;
  const maximo = Math.max(1, ...modelo.publicos.flatMap((item) => item.serie.map((dia) => dia.efectivas)));
  return (
    <div className="acr-mo-ventana" data-qa-geometry-group="acreditacion-modelo-ventana" data-qa-geometry-contract="intrinsic">
      <section className="acr-av-panel" aria-label="Ventana de cada público">
        <CabeceraDeTarjeta primera><h3>Ventana de cada público <span className="acr-av-tenue">Del primer día con respuestas a la última efectiva</span></h3></CabeceraDeTarjeta>
        <div className="acr-cl-cifras acr-mo-cifras" data-qa-geometry-group="acreditacion-ventana-cifras" data-qa-geometry-contract="equal">
          <div className="acr-res-kpi" data-qa-geometry-member><small>Primer día con respuestas</small><b className="acr-av-num">{desde ? fechaCorta(desde) : "—"}</b></div>
          <div className="acr-res-kpi" data-qa-geometry-member><small>Último día</small><b className="acr-av-num">{hasta ? fechaCorta(hasta) : "—"}</b></div>
          <div className="acr-res-kpi" data-qa-geometry-member><small>Días con efectivas</small><b className="acr-av-num">{diasDelCampo ? `${fmt(modelo.diasConEfectivas)} de ${fmt(diasDelCampo)}` : "—"}</b></div>
          <div className="acr-res-kpi" data-qa-geometry-member><small>Fases declaradas</small><b className="acr-av-num">{fmt(modelo.fasesDeclaradas)}</b></div>
        </div>
        {desde && hasta ? (
          <div className="acr-mo-linea" role="table" aria-label="Ventana de cada público">
            <div className="acr-mo-fila is-plan" role="row">
              <span role="rowheader">Plan de campo</span>
              <span className="acr-mo-pista" role="cell">
                {modelo.fases.length
                  ? modelo.fases.map((fase) => <Banda key={fase.id} desde={fase.desde} hasta={fase.hasta} inicio={desde} total={diasDelCampo} clase="is-plan" />)
                  : <span className="acr-mo-sin-fases">Sin fases con fechas</span>}
              </span>
              <span className="acr-av-tenue" role="cell">{modelo.fases.length ? `${fmt(modelo.fases.length)} ${modelo.fases.length === 1 ? "fase" : "fases"}` : "Se declaran abajo"}</span>
            </div>
            {modelo.publicos.map((item) => (
              <div key={item.publico} className="acr-mo-fila" role="row">
                <span role="rowheader">{item.publico}</span>
                <span className="acr-mo-pista" role="cell" aria-label={item.desde && item.hasta ? `De ${fechaCorta(item.desde)} a ${fechaCorta(item.hasta)}` : "Sin respuestas"}>
                  {item.desde && item.hasta ? <Banda desde={item.desde} hasta={item.hasta} inicio={desde} total={diasDelCampo} clase="is-real" /> : null}
                  {item.serie.filter((dia) => dia.efectivas > 0).map((dia) => (
                    <span
                      key={dia.fecha}
                      className="acr-mo-dia"
                      style={{ left: `${posicion(dia.fecha, desde, diasDelCampo)}%`, opacity: 0.25 + 0.75 * (dia.efectivas / maximo) }}
                      title={`${fechaCorta(dia.fecha)}: ${fmt(dia.efectivas)} efectivas`}
                    />
                  ))}
                </span>
                <span className="acr-av-tenue acr-av-num" role="cell">{item.desde && item.hasta ? `${fechaCorta(item.desde)} a ${fechaCorta(item.hasta)}` : "Sin respuestas"}</span>
              </div>
            ))}
            <div className="acr-mo-fila is-eje" aria-hidden="true">
              <span />
              <span className="acr-mo-pista">
                <span className="acr-mo-eje-texto" style={{ left: 0 }}>{fechaCorta(desde)}</span>
                <span className="acr-mo-eje-texto is-fin" style={{ right: 0 }}>{fechaCorta(hasta)}</span>
              </span>
              <span />
            </div>
          </div>
        ) : <VacioDeBloque icono={<CalendarDays size={15} />} titulo="El corte todavía no trae respuestas con fecha." descripcion="La ventana de cada público aparece con las primeras respuestas." />}
      </section>
      {editorDelPlan}
    </div>
  );
}
