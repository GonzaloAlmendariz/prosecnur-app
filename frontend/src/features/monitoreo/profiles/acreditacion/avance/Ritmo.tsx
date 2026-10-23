import { useMemo, type ReactNode } from "react";
import { CalendarRange, ListChecks } from "lucide-react";
import { Alert } from "../../../../../components/Alert";
import type { MonitoreoStrategyPhase } from "../../../../../api/client";
import { usePanelDireccionable, type PanelDeclarado } from "../../../../../lib/navegacion/paneles";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { SuperficieFlotante } from "../../../core/superficieFlotante/SuperficieFlotante";
import { fmt } from "../formato";
import { BarrasApiladas, fechaCorta } from "./graficosDeAvance";
import { mapaPorSemana } from "./mapaDeCalor";
import { fasesConFechas, nombresDePublicos, pulsoDelCampo, seriesApiladas } from "./ritmoModelo";
import "./avance.css";

/** El desglose por fuente y recopilador: `panel=fuentes`. */
export const PANEL_FUENTES: PanelDeclarado = { id: "fuentes", label: "Por fuente y recopilador", clase: "sideover" };

const UNA_DECIMAL = (valor: number) => valor.toLocaleString("es-PE", { maximumFractionDigits: 1 });

type PropsDeVista = {
  actores: ReadonlyArray<Record<string, unknown>>;
  diarioGeneral: ReadonlyArray<Record<string, unknown>>;
  diarioPorPublico: ReadonlyArray<Record<string, unknown>>;
  fuentes: ReadonlyArray<Record<string, unknown>>;
  fases: readonly MonitoreoStrategyPhase[];
  onDeclararFases: () => void;
  onVerFuentes?: () => void;
};

export function RitmoVista({ actores, diarioGeneral, diarioPorPublico, fuentes, fases, onDeclararFases, onVerFuentes }: PropsDeVista) {
  const serie = useMemo(() => seriesApiladas(diarioPorPublico, diarioGeneral, nombresDePublicos(actores)), [diarioPorPublico, diarioGeneral, actores]);
  const plan = fasesConFechas(fases);
  const pulso = pulsoDelCampo(serie, fuentes, actores);
  const mapa = mapaPorSemana(serie);
  const maxSemana = Math.max(1, ...pulso.porDiaDeLaSemana.map((dia) => dia.promedio));
  const totalCanal = pulso.porCanal.reduce((suma, item) => suma + item.efectivas, 0);
  if (!serie.fechas.length) {
    return <div className="acr-cr is-vacio" data-vacio><Alert kind="info">El corte todavía no trae efectivas con fecha.</Alert></div>;
  }
  return (
    <div className="acr-ri" data-qa-geometry-group="acreditacion-avance-ritmo" data-qa-geometry-contract="intrinsic">
      <div className="acr-ri-izquierda">
        <section className="acr-av-panel acr-ri-diario" aria-label="Efectivas por día">
          <header className="acr-av-panel-cabecera">
            <h3>Efectivas por día <span className="acr-av-tenue">{`${fechaCorta(serie.fechas[0])} a ${fechaCorta(serie.fechas.at(-1) as string)}, por público`}</span></h3>
            {onVerFuentes ? (
              <button type="button" className="acr-av-boton" onClick={onVerFuentes}>
                <ListChecks size={14} aria-hidden="true" /> Por fuente y recopilador
              </button>
            ) : null}
          </header>
          {plan.length ? null : (
            <div className="acr-ri-plan">
              <span className="acr-av-tenue">Plan de campo: sin fases con fechas.</span>
              <button type="button" className="acr-av-boton" onClick={onDeclararFases}><CalendarRange size={14} aria-hidden="true" /> Declarar fases</button>
            </div>
          )}
          <BarrasApiladas fechas={serie.fechas} capas={serie.capas} totales={serie.totales} fases={plan} etiqueta={`Efectivas por día de ${fmt(serie.fechas.length)} días, por público`} />
          <ul className="acr-ri-leyenda" aria-label="Públicos">
            {serie.capas.map((capa, indice) => (
              <li key={capa.publico}><i className={`acr-av-capa-muestra is-capa-${indice + 1}`} aria-hidden="true" />{capa.publico} <b className="acr-av-num">{fmt(capa.total)}</b></li>
            ))}
          </ul>
        </section>
        <section className="acr-av-panel acr-ri-mapa" aria-label="Efectivas por semana">
          <header className="acr-av-panel-cabecera"><h3>Efectivas por semana <span className="acr-av-tenue">Semanas de lunes a domingo</span></h3></header>
          <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
            <table className="acr-pub-tabla acr-ri-calor">
              <thead>
                <tr>
                  <th scope="col">Público</th>
                  {mapa.semanas.map((semana) => <th key={semana} scope="col" className="is-num">{fechaCorta(semana)}</th>)}
                </tr>
              </thead>
              <tbody>
                {mapa.filas.map((fila) => (
                  <tr key={fila.publico}>
                    <th scope="row">{fila.publico}</th>
                    {fila.valores.map((valor, indice) => (
                      <td
                        key={mapa.semanas[indice]}
                        className={`is-num acr-ri-celda${valor ? "" : " is-cero"}`}
                        style={valor ? { background: `color-mix(in srgb, var(--acr-efectiva) ${Math.round(8 + 62 * (valor / Math.max(1, mapa.maximo)))}%, var(--pulso-surface))`, color: valor / Math.max(1, mapa.maximo) > 0.55 ? "var(--pulso-surface)" : undefined } : undefined}
                      >
                        {valor ? fmt(valor) : "·"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <aside className="acr-av-panel acr-ri-pulso" aria-label="Pulso del campo">
        <header className="acr-av-panel-cabecera"><h3>Pulso del campo</h3></header>
        <div className="acr-ri-pulso-cuerpo" data-qa-geometry-capacity="owned">
          <dl className="acr-ri-cifras">
            <div><dt>Promedio de los últimos 7 días</dt><dd className="acr-av-num">{UNA_DECIMAL(pulso.promedio7)}</dd></div>
            <div><dt>Mejor día</dt><dd className="acr-av-num">{pulso.mejor ? `${fmt(pulso.mejor.efectivas)}, ${fechaCorta(pulso.mejor.fecha)}` : "—"}</dd></div>
            <div><dt>Días con efectivas</dt><dd className="acr-av-num">{`${fmt(pulso.diasConEfectivas)} de ${fmt(pulso.dias)}`}</dd></div>
            <div><dt>Canal que más aporta</dt><dd>{pulso.porCanal[0] ? pulso.porCanal[0].canal : "—"}</dd></div>
          </dl>
          <section aria-label="Promedio por día de la semana">
            <span className="acr-av-antetitulo">Promedio por día de la semana</span>
            <ul className="acr-ri-barras">
              {pulso.porDiaDeLaSemana.map((dia) => (
                <li key={dia.dia}>
                  <span>{dia.dia}</span>
                  <span className="acr-av-pista"><i style={{ width: `${(dia.promedio / maxSemana) * 100}%` }} /></span>
                  <b className="acr-av-num">{UNA_DECIMAL(dia.promedio)}</b>
                </li>
              ))}
            </ul>
          </section>
          {pulso.porCanal.length ? (
            <section aria-label="Efectivas por canal">
              <span className="acr-av-antetitulo">Efectivas por canal</span>
              <ul className="acr-ri-barras">
                {pulso.porCanal.map((item) => (
                  <li key={item.canal}>
                    <span>{item.canal}</span>
                    <span className="acr-av-pista"><i style={{ width: `${totalCanal ? (item.efectivas / totalCanal) * 100 : 0}%` }} /></span>
                    <b className="acr-av-num">{fmt(item.efectivas)}</b>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section aria-label="Última efectiva por público">
            <span className="acr-av-antetitulo">Última efectiva por público</span>
            <ul className="acr-ri-ultimas">
              {pulso.ultimaPorPublico.map((item) => (
                <li key={item.publico}><span>{item.publico}</span><b className="acr-av-num">{item.fecha ? fechaCorta(item.fecha) : "Sin efectivas"}</b></li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}

/**
 * Avance › Ritmo (ficha A4): a qué velocidad entra. Las fases se declaran en
 * Modelo › Ventana de campo; aquí solo se dibujan. El desglose de siempre por
 * fuente, canal y recopilador queda en un sideover (`panel=fuentes`).
 */
export function Ritmo({ detallePorFuente, ...props }: Omit<PropsDeVista, "onDeclararFases" | "onVerFuentes"> & { detallePorFuente?: ReactNode }) {
  const [, escribirFoco] = useFocoMonitoreo();
  const panel = usePanelDireccionable(PANEL_FUENTES);
  return (
    <>
      <RitmoVista
        {...props}
        onDeclararFases={() => escribirFoco(null, { seccion: "modelo", pestana: "ventana", panel: null })}
        onVerFuentes={detallePorFuente ? panel.abrir : undefined}
      />
      {panel.abierto && detallePorFuente ? (
        <SuperficieFlotante tipo="sideover" antetitulo="Ritmo" titulo="Por fuente y recopilador" onCerrar={panel.cerrar} panelId={PANEL_FUENTES.id} ancho={1240}>
          {detallePorFuente}
        </SuperficieFlotante>
      ) : null}
    </>
  );
}
