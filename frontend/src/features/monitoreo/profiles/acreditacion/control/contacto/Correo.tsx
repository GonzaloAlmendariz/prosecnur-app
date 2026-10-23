import { useMemo } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { Alert } from "../../../../../../components/Alert";
import type { MonitoreoMailchimpAudiencia, MonitoreoMailchimpEstado } from "../../../../../../api/monitoreoMailchimp";
import { useFocoMonitoreo } from "../../../../useMonitoreoDireccion";
import { corteCorto } from "../../../../core/barraComun";
import { AvanceCorreoVista } from "../../AvanceCorreoVista";
import { fechaCorta } from "../../avanceCorreoMatriz";
import { tramosDelPublico } from "../../avanceCorreoEmbudoModelo";
import { cifra, faseCorreo, marcaReadiness, motivoInvalido, nombreAudiencia, porcentaje, RITMO, type AvanceDeLectura } from "../../avanceCorreoModelo";
import { descargarCsv } from "../casos/descargarCsv";
import { campanas, csvDeInvalidos, rotuloDeColumna, secuenciaDeEnvios, tasasPorPublico } from "./correoModelo";
import { useCorreoMailchimp } from "./useCorreoMailchimp";
import "../../avance/avance.css";
import "./contacto.css";

type PropsDeVista = {
  estado: MonitoreoMailchimpEstado;
  audiencias: readonly MonitoreoMailchimpAudiencia[];
  foco: string | null;
  lectura: AvanceDeLectura | null;
  aviso?: string;
  error?: string;
  onElegirPublico: (publico: string) => void;
  onLeer: () => void;
  onCambiarAudiencia: () => void;
};

function Paso({ rotulo, valor, base }: { rotulo: string; valor: number | null; base: number | null }) {
  const ancho = valor != null && base ? Math.min(100, (valor / base) * 100) : 0;
  return (
    <li>
      <span>{rotulo}</span>
      <span className="acr-av-pista is-gruesa"><i style={{ width: `${ancho}%` }} /></span>
      <b className="acr-av-num">{valor == null ? "—" : cifra(valor)}</b>
      <span className="acr-av-tenue acr-av-num">{valor != null && base ? porcentaje(valor / base) : ""}</span>
    </li>
  );
}

export function CorreoVista({ estado, audiencias, foco, lectura, aviso, error, onElegirPublico, onLeer, onCambiarAudiencia }: PropsDeVista) {
  const secuencia = useMemo(() => secuenciaDeEnvios(estado.publicos, estado.envios), [estado]);
  const listaDeCampanas = useMemo(() => campanas(estado.publicos, estado.envios), [estado]);
  const tasas = tasasPorPublico(estado.publicos);
  const maxTasa = Math.max(0.0001, ...tasas.map((item) => item.tasa ?? 0));
  const elegido = secuencia.filas.find((fila) => fila.publico.actor === foco)?.publico ?? secuencia.filas[0]?.publico ?? null;
  const tramos = elegido ? tramosDelPublico(estado.envios, elegido.actor) : [];
  const respuestasAtribuidas = estado.envios.reduce((suma, envio) => suma + (envio.respuestas ?? 0), 0);
  const titulos = new Map(estado.envios.map((envio) => [envio.campaign_id, envio.titulo || envio.campaign_id]));
  const invalidos = estado.invalidos.total ?? estado.invalidos.filas.length;
  const u = estado.umbrales;
  return (
    <div className="acr-co" data-qa-geometry-group="acreditacion-control-correo" data-qa-geometry-contract="intrinsic">
      <span hidden data-audit-ready={marcaReadiness("listo")} />
      <div className="acr-co-izquierda">
        {aviso ? <Alert kind="info">{aviso}</Alert> : null}
        {error ? <Alert kind="error">{error}</Alert> : null}
        {estado.avisos.map((texto) => <Alert key={texto} kind="warn">{texto}</Alert>)}
        <section className="acr-av-panel" aria-label="Secuencia de envíos por público">
          <header className="acr-av-panel-cabecera">
            <h3>Secuencia de envíos por público <span className="acr-av-tenue">Entregados y respuestas atribuidas, en el orden de envío de cada público</span></h3>
          </header>
          <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
            <table className="acr-pub-tabla acr-co-matriz">
              <thead>
                <tr>
                  <th scope="col">Público</th>
                  <th scope="col" className="is-num">Universo</th>
                  <th scope="col" className="is-num">Alcanzable</th>
                  {Array.from({ length: secuencia.columnas }, (_, indice) => <th key={indice} scope="col" className="acr-co-col">{rotuloDeColumna(indice + 1)}</th>)}
                  <th scope="col">Ritmo</th>
                </tr>
              </thead>
              <tbody>
                {secuencia.filas.map((fila) => {
                  const activa = fila.publico.actor === elegido?.actor;
                  const ritmo = RITMO[fila.publico.ritmo];
                  return (
                    <tr key={fila.publico.actor} className={activa ? "is-activa" : undefined}>
                      <th scope="row">
                        <button type="button" className="acr-co-publico" aria-pressed={activa} onClick={() => onElegirPublico(fila.publico.actor)}>{fila.publico.actor}</button>
                      </th>
                      <td className="is-num">{cifra(fila.publico.universo)}</td>
                      <td className="is-num">{cifra(fila.publico.alcanzable)}</td>
                      {fila.celdas.map((celda, indice) => (
                        <td key={indice} className="acr-co-col">
                          {celda ? (
                            <span className="acr-co-celda" title={`${celda.titulo}, ${fechaCorta(celda.fecha)}`}>
                              <b className="acr-av-num">{cifra(celda.entregados)}</b>
                              <small className="acr-av-num">{`${cifra(celda.respuestas)} resp.`}</small>
                            </span>
                          ) : <span className="acr-co-celda is-vacia" aria-label="Sin envío" />}
                        </td>
                      ))}
                      <td><span className={`acr-co-ritmo is-${ritmo.tono}`} title={fila.publico.ritmo_motivo}>{ritmo.etiqueta}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        {elegido ? (
          <section className="acr-av-panel" aria-label={`Envíos a ${elegido.actor}`}>
            <header className="acr-av-panel-cabecera">
              <h3>{elegido.actor}</h3>
              <span className="acr-co-chips">
                <span className="acr-co-chip">{`Base alcanzable de ${cifra(elegido.alcanzable)}`}</span>
                {elegido.efectivas != null ? <span className="acr-co-chip is-ok">{`${cifra(elegido.efectivas)} efectivas, el ${porcentaje(elegido.tasa_alcanzable)}`}</span> : null}
              </span>
            </header>
            {tramos.length ? (
              <div className="acr-co-embudos">
                {tramos.map((tramo, indice) => {
                  const c = tramo.cifras;
                  const sinApple = c.aperturas_sin_proxy;
                  return (
                    <article key={tramo.envio.campaign_id} className="acr-co-embudo">
                      <h4>{indice === 0 ? "Invitación" : `Recordatorio ${indice}`} <span className="acr-av-tenue">{`${fechaCorta(tramo.envio.enviado_at)} · ${cifra(c.enviados)} enviados`}</span></h4>
                      <ul>
                        <Paso rotulo="Entregados" valor={c.entregados} base={c.entregados} />
                        <Paso rotulo={sinApple == null ? "Abrieron, con Apple" : "Abrieron, sin contar Apple"} valor={sinApple ?? c.aperturas} base={c.entregados} />
                        <Paso rotulo="Clic en la encuesta" valor={c.clics} base={c.entregados} />
                        <Paso rotulo="Respondieron" valor={c.respuestas} base={c.entregados} />
                      </ul>
                      <span className="acr-co-chips">
                        <span className="acr-co-chip">{`${cifra(c.rebotes_duros)} rebotes duros`}</span>
                        <span className="acr-co-chip">{`${cifra(c.rebotes_blandos)} blandos`}</span>
                        <span className="acr-co-chip">{`${cifra(c.bajas)} bajas`}</span>
                        <span className="acr-co-chip">{`${cifra(c.quejas)} quejas`}</span>
                      </span>
                    </article>
                  );
                })}
              </div>
            ) : <div className="acr-ct-cuerpo"><Alert kind="info">Este público todavía no recibe envíos.</Alert></div>}
          </section>
        ) : null}
        <section className="acr-av-panel" aria-label="Campañas">
          <header className="acr-av-panel-cabecera"><h3>Campañas <span className="acr-av-tenue">Cada envío con su papel en cada público</span></h3></header>
          <div className="acr-pr-cola-marco" data-qa-geometry-capacity="owned">
            <table className="acr-pub-tabla">
              <thead>
                <tr>
                  <th scope="col">Campaña</th>
                  <th scope="col">Salió</th>
                  <th scope="col">Papel por público</th>
                  <th scope="col" className="is-num">Entregados</th>
                  <th scope="col" className="is-num">Respuestas</th>
                </tr>
              </thead>
              <tbody>
                {listaDeCampanas.map((campana) => (
                  <tr key={campana.campaignId}>
                    <th scope="row">{campana.titulo}{campana.etiqueta ? <small className="acr-av-tenue acr-co-etiqueta">{campana.etiqueta}</small> : null}</th>
                    <td>{campana.fecha ? fechaCorta(campana.fecha) : "—"}</td>
                    <td>
                      <ul className="acr-co-papeles">
                        {campana.papeles.map((papel) => (
                          <li key={papel.publico}>
                            <b>{papel.publico}</b>{`: ${papel.rotulo}`}
                            {papel.recordatorioDe ? <span className="acr-av-tenue">{` de «${papel.recordatorioDe}»`}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="is-num">{cifra(campana.entregados)}</td>
                    <td className="is-num">{cifra(campana.respuestas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <aside className="acr-co-derecha" aria-label="Audiencia y umbrales">
        <section className="acr-av-panel" aria-label="Audiencia">
          <header className="acr-av-panel-cabecera">
            <h3>Audiencia</h3>
            <span className="acr-co-chip is-ok">Conectada</span>
          </header>
          <div className="acr-co-cuerpo">
            {/* Sin la lista de audiencias de la cuenta no hay nombre que mostrar: no se pone el identificador en su lugar. */}
            <strong className="acr-co-audiencia">{audiencias.some((item) => item.id === estado.list_id) ? nombreAudiencia(estado.list_id, audiencias) : "Audiencia de Mailchimp"}</strong>
            <span className="acr-av-tenue">{estado.leido_at ? `Leída el ${corteCorto(estado.leido_at)}` : "Sin leer"}</span>
            <span className="acr-av-tenue acr-av-num">{`Lista ${estado.list_id}`}</span>
            <dl className="acr-co-cifras">
              <div><dt>Envíos leídos</dt><dd className="acr-av-num">{cifra(estado.envios.length)}</dd></div>
              <div><dt>Respuestas atribuidas</dt><dd className="acr-av-num">{cifra(respuestasAtribuidas)}</dd></div>
              <div><dt>Inválidos</dt><dd className="acr-av-num">{cifra(invalidos)}</dd></div>
            </dl>
            <span className="acr-co-acciones">
              <button type="button" className="acr-av-boton" onClick={onLeer} disabled={Boolean(lectura)}>
                {lectura ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
                {lectura ? `Leyendo${lectura.percent != null ? ` ${Math.round(lectura.percent)} %` : ""}` : "Leer Mailchimp"}
              </button>
              <button type="button" className="acr-av-boton" onClick={onCambiarAudiencia} disabled={Boolean(lectura)}>Cambiar audiencia</button>
            </span>
          </div>
        </section>
        <section className="acr-av-panel" aria-label="Umbrales de ritmo">
          <header className="acr-av-panel-cabecera"><h3>Umbrales de ritmo</h3></header>
          <ul className="acr-co-cuerpo acr-co-umbrales">
            <li><span>Bajas del último envío</span><span className="acr-co-chip is-warning">{`Espaciar desde ${porcentaje(u.baja_espaciar)}`}</span></li>
            <li><span>Quejas del último envío</span><span className="acr-co-chip is-warning">{`Espaciar desde ${porcentaje(u.queja_espaciar)}`}</span></li>
            <li><span>Quejas del último envío</span><span className="acr-co-chip is-danger">{`Detener desde ${porcentaje(u.queja_detener)}`}</span></li>
            <li><span>Respuestas menores que bajas</span><span className="acr-co-chip is-warning">Espaciar</span></li>
          </ul>
        </section>
        <section className="acr-av-panel" aria-label="Tasa sobre la base alcanzable">
          <header className="acr-av-panel-cabecera"><h3>Tasa sobre la base alcanzable</h3></header>
          <ul className="acr-co-cuerpo acr-co-tasas">
            {tasas.map((item) => (
              <li key={item.publico}>
                <span>{item.publico}</span>
                <span className="acr-av-pista"><i style={{ width: `${((item.tasa ?? 0) / maxTasa) * 100}%` }} /></span>
                <b className="acr-av-num">{porcentaje(item.tasa)}</b>
              </li>
            ))}
          </ul>
        </section>
        <section className="acr-av-panel" aria-label="Correos inválidos">
          <header className="acr-av-panel-cabecera">
            <h3>Correos inválidos <span className="acr-av-tenue acr-av-num">{cifra(invalidos)}</span></h3>
            <button
              type="button"
              className="acr-av-boton"
              disabled={!estado.invalidos.filas.length}
              onClick={() => descargarCsv(csvDeInvalidos(estado.invalidos.filas, titulos, motivoInvalido), "correos-invalidos.csv")}
            >
              <Download size={14} aria-hidden="true" /> Exportar
            </button>
          </header>
          {estado.invalidos.por_actor.some((item) => (item.n ?? 0) > 0) ? (
            <ul className="acr-co-cuerpo acr-co-umbrales">
              {estado.invalidos.por_actor.filter((item) => (item.n ?? 0) > 0).map((item) => (
                <li key={item.actor}><span>{item.actor}</span><b className="acr-av-num">{cifra(item.n)}</b></li>
              ))}
            </ul>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

/**
 * Control › Correo (ficha Ctl1): cómo rinde cada envío y cuándo insistir.
 * Con la audiencia leída, la secuencia por público, el embudo de cada envío al
 * público elegido (`foco`) y las campañas; a la derecha, audiencia, umbrales,
 * tasa sobre la base alcanzable e inválidos. Conectar, elegir audiencia y los
 * estados vacíos siguen en la vista de siempre (`AvanceCorreoVista`).
 */
export function Correo() {
  const correo = useCorreoMailchimp();
  const [foco, escribirFoco] = useFocoMonitoreo();
  const { s } = correo;
  const fase = faseCorreo({ estado: s.estado, cargando: s.cargando, error: s.error });
  if (fase !== "listo" || !s.estado || correo.cambiando) return <AvanceCorreoVista {...correo} />;
  return (
    <CorreoVista
      estado={s.estado}
      audiencias={s.audiencias}
      foco={foco}
      lectura={s.lectura}
      aviso={s.aviso}
      error={s.error}
      onElegirPublico={(publico) => escribirFoco(publico)}
      onLeer={correo.onActualizar}
      onCambiarAudiencia={correo.onCambiar}
    />
  );
}
