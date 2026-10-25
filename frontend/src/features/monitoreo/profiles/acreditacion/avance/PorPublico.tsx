import { useMemo } from "react";
import { usePanelDireccionable, type PanelDeclarado } from "../../../../../lib/navegacion/paneles";
import { pctConEspacio } from "../../../core/formatoComun";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { fmt, normalizeSourceMatch } from "../formato";
import { enFechas, porUniverso, serieDiaria, seriesPorPublico, tieneMeta, totalesDeAvance, ultimosDias } from "./avanceModelo";
import { estadosDelUniverso } from "./EstadoDelUniverso";
import { Minibarras } from "./graficosDeAvance";
import { PanelPublico } from "./PanelPublico";
import { useResumenDelCorte } from "../navegacion/resumenDelCorte";
import type { AcreditacionAdvanceCard } from "./tarjetasDeAvance";
import "./avance.css";
import { CabeceraDeTarjeta } from "../navegacion/rotuloDePestana";

/** El inspector del público es un panel direccionable: `panel=publico&foco=<público>`. */
export const PANEL_PUBLICO: PanelDeclarado = { id: "publico", label: "Público", clase: "inspector" };

function porcentaje(valor: number, total: number) {
  return total > 0 ? pctConEspacio((valor / total) * 100) : "—";
}

function BarraDeAvance({ tarjeta }: { tarjeta: AcreditacionAdvanceCard }) {
  if (!tieneMeta(tarjeta)) return <span className="acr-av-chip">Sin meta</span>;
  const avance = tarjeta.effective / (tarjeta.meta as number);
  return (
    <span className="acr-pub-avance">
      <span className="acr-av-pista"><i className={avance >= 1 ? "is-cumple" : "is-efectiva"} style={{ width: `${Math.min(100, avance * 100)}%` }} /></span>
      <b className="acr-av-num">{fmt(Math.round(avance * 100))} %</b>
    </span>
  );
}

/**
 * Avance › Por público (ficha A2): ¿quién se queda atrás y por qué? Tabla de
 * públicos ordenada por universo con su avance contra la meta, el universo de
 * cada público por estado y el inspector del público elegido.
 */
type PropsDePorPublico = {
  tarjetas: readonly AcreditacionAdvanceCard[];
  diarioGeneral: ReadonlyArray<Record<string, unknown>>;
  diarioPorPublico: ReadonlyArray<Record<string, unknown>>;
  fuentes: ReadonlyArray<Record<string, unknown>>;
};

/** Lee del corte observado los casos y el barrido, que llegan con Control. */
export function PorPublico(props: PropsDePorPublico) {
  const issues = useResumenDelCorte((estado) => estado.issues);
  const barridos = useResumenDelCorte((estado) => estado.barrido);
  return <PorPublicoVista {...props} issues={issues} barridos={barridos} />;
}

export function PorPublicoVista({
  tarjetas,
  diarioGeneral,
  diarioPorPublico,
  fuentes,
  issues,
  barridos,
}: PropsDePorPublico & Pick<Parameters<typeof PanelPublico>[0], "issues" | "barridos">) {
  const panel = usePanelDireccionable(PANEL_PUBLICO);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const filas = useMemo(() => porUniverso(tarjetas), [tarjetas]);
  const totales = useMemo(() => totalesDeAvance(tarjetas), [tarjetas]);
  const serie = useMemo(() => serieDiaria(diarioGeneral), [diarioGeneral]);
  const fechas14 = ultimosDias(serie).dias.map((dia) => dia.fecha);
  const porPublico = useMemo(() => seriesPorPublico(diarioPorPublico), [diarioPorPublico]);
  // Con el panel cerrado el inspector muestra el primer público: es el
  // inspector implícito. Solo un público ELEGIDO es dirección.
  const elegido = panel.abierto && foco ? filas.find((fila) => normalizeSourceMatch(fila.actor) === normalizeSourceMatch(foco)) ?? null : null;
  const enInspector = elegido ?? filas[0] ?? null;
  const elegir = (actor: string) => escribirFoco(actor, { panel: PANEL_PUBLICO.id });

  return (
    <div className="acr-pub" data-qa-geometry-group="acreditacion-avance-publicos" data-qa-geometry-contract="intrinsic">
      <div className="acr-pub-izquierda">
        <section className="acr-av-panel acr-pub-tabla-panel" aria-label="Públicos">
          <CabeceraDeTarjeta primera>
            <h3>{fmt(filas.length)} {filas.length === 1 ? "público" : "públicos"} <span className="acr-av-tenue">Ordenados por universo</span></h3>
          </CabeceraDeTarjeta>
          <div className="acr-pub-tabla-marco" data-qa-geometry-capacity="owned">
            <table className="acr-pub-tabla">
              <thead>
                <tr>
                  <th scope="col">Público</th>
                  <th scope="col" className="is-num">Universo</th>
                  <th scope="col" className="is-num">Meta</th>
                  <th scope="col" className="is-num">Efectivas</th>
                  <th scope="col">Avance contra la meta</th>
                  <th scope="col" className="is-num">Del universo</th>
                  <th scope="col" className="is-num">Sin respuesta</th>
                  <th scope="col" className="acr-pub-col-ultimos">Últimos 14 días</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((tarjeta) => {
                  const activa = enInspector?.id === tarjeta.id;
                  return (
                    <tr key={tarjeta.id} className={activa ? "is-activa" : undefined} aria-selected={activa}>
                      <th scope="row">
                        <button type="button" className="acr-pub-nombre" onClick={() => elegir(tarjeta.actor)} aria-pressed={Boolean(elegido) && activa}>
                          {tarjeta.actor}
                        </button>
                      </th>
                      <td className="is-num">{fmt(tarjeta.universe)}</td>
                      <td className="is-num">{tieneMeta(tarjeta) ? fmt(tarjeta.meta) : "—"}</td>
                      <td className="is-num"><b>{fmt(tarjeta.effective)}</b></td>
                      <td><BarraDeAvance tarjeta={tarjeta} /></td>
                      <td className="is-num">{porcentaje(tarjeta.effective, tarjeta.universe)}</td>
                      <td className="is-num">{fmt(tarjeta.pending)}</td>
                      <td className="acr-pub-col-ultimos">
                        <Minibarras
                          valores={enFechas(porPublico.get(normalizeSourceMatch(tarjeta.actor)), fechas14)}
                          etiqueta={`Efectivas de ${tarjeta.actor} en los últimos 14 días`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="is-num">{fmt(totales.universo)}</td>
                  <td className="is-num">{totales.meta > 0 ? fmt(totales.meta) : "—"}</td>
                  <td className="is-num">{fmt(totales.efectivas)}</td>
                  <td className="is-num">{totales.meta > 0 ? pctConEspacio((totales.efectivas / totales.meta) * 100) : "—"}</td>
                  <td className="is-num">{porcentaje(totales.efectivas, totales.universo)}</td>
                  <td className="is-num">{fmt(totales.sinRespuesta)}</td>
                  <td className="acr-pub-col-ultimos" />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
        <section className="acr-av-panel acr-pub-estados" aria-label="Universo de cada público por estado">
          <header className="acr-av-panel-cabecera">
            <h3>Universo de cada público por estado</h3>
          </header>
          <ul className="acr-pub-estados-lista" data-qa-geometry-group="acreditacion-publicos-estados" data-qa-geometry-contract="equal" data-qa-geometry-capacity="owned">
            {filas.map((tarjeta) => {
              const estados = estadosDelUniverso({
                efectivas: tarjeta.effective,
                parciales: tarjeta.partial,
                rechazos: tarjeta.refusals,
                sinRespuesta: tarjeta.pending,
              });
              return (
                <li key={tarjeta.id} data-qa-geometry-member>
                  <span className="acr-pub-estados-nombre">{tarjeta.actor}</span>
                  <span className="acr-av-apilada" role="img" aria-label={`${tarjeta.actor}: ${estados.map((estado) => `${estado.etiqueta} ${fmt(estado.valor)}`).join(", ")}`}>
                    {estados.map((estado) => (estado.valor > 0 ? (
                      <span key={estado.clave} className={`is-${estado.clave}`} style={{ flexGrow: estado.valor }}>
                        {estado.clave !== "sin-respuesta" && tarjeta.universe > 0 && estado.valor / tarjeta.universe > 0.08 ? fmt(estado.valor) : null}
                      </span>
                    ) : null))}
                  </span>
                  <span className="acr-av-num acr-pub-estados-pct">{porcentaje(tarjeta.effective, tarjeta.universe)}</span>
                </li>
              );
            })}
          </ul>
          <span className="acr-av-leyenda is-centrada">
            {estadosDelUniverso(totales).map((estado) => (
              <span key={estado.clave}><i className={`acr-av-punto is-${estado.clave}`} aria-hidden="true" />{estado.etiqueta}</span>
            ))}
          </span>
        </section>
      </div>
      {enInspector ? (
        <PanelPublico
          tarjeta={enInspector}
          serie={porPublico.get(normalizeSourceMatch(enInspector.actor)) ?? []}
          fuentes={fuentes}
          elegido={Boolean(elegido)}
          issues={issues}
          barridos={barridos}
          onCerrar={() => escribirFoco(null, { panel: null })}
        />
      ) : null}
    </div>
  );
}
