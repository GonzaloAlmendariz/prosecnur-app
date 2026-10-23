import { useMemo, type ReactNode } from "react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { pctConEspacio } from "../../../core/formatoComun";
import { segmentoDelCorte } from "../control/montaje";
import { construirRespuestas } from "../control/respuestasModel";
import {
  UMBRAL_DE_CRUCE,
  cruceDeLlave,
  ejemplosDeLlave,
  enviosPorLlave,
  filtroDePrueba,
  llaveDeclarada,
  porRevisarEnLaLlave,
} from "./llaveModel";
import "../control/controlTelefonico.css";
import "./insumosTelefonico.css";

const COMO_CRUZO = { exacta: "Exacta", normalizada: "Por sus dígitos", "no-cruza": "No cruza" } as const;

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

function Columnas({ titulo, columnas }: { titulo: string; columnas: string[] }) {
  return (
    <div className="mon-llave-columnas">
      <span className="mon-ctl-antetitulo">{titulo}</span>
      {columnas.length ? (
        <p>
          <code>{columnas[0]}</code>
          {columnas.length > 1 ? <span title={columnas.slice(1).join(", ")}> y {n(columnas.length - 1)} más si no la encuentra</span> : null}
        </p>
      ) : <p>Sin columna declarada</p>}
    </div>
  );
}

/**
 * Insumos › Llave y filtros: con qué columna cruza cada respuesta con la hoja
 * (en lectura: hoy no se edita desde la app), cómo cruzaron las efectivas de
 * este corte, qué cuenta como efectiva (el editor de siempre) y cada efectiva
 * con su cruce. A la derecha, la encuesta conectada y lo que no cruzó tal cual.
 */
export function LlaveYFiltros({
  reports,
  state,
  filtro,
  tarjetaKobo,
  onIrA,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
  /** El editor del filtro de efectiva que ya existe. */
  filtro: ReactNode;
  /** La tarjeta de la encuesta, con «Cambiar conexión». */
  tarjetaKobo: ReactNode;
  onIrA: (seccion: string, pestana: string) => void;
}) {
  const llave = llaveDeclarada(state);
  const ejemplos = useMemo(() => ejemplosDeLlave(reports), [reports]);
  const respuestas = useMemo(() => construirRespuestas({ reports, segmento: segmentoDelCorte(reports) }), [reports]);
  const cruce = cruceDeLlave(respuestas);
  const envios = useMemo(() => enviosPorLlave(respuestas.envios), [respuestas.envios]);
  const porRevisar = useMemo(() => porRevisarEnLaLlave(respuestas.envios), [respuestas.envios]);
  const prueba = filtroDePrueba(state);
  const bajo = cruce.tasa != null && cruce.tasa < UMBRAL_DE_CRUCE;

  return (
    <div className="mon-insumos mon-llave" data-qa-geometry-group="telefonico-insumos-llave" data-qa-geometry-contract="intrinsic">
      <div className="mon-insumos-columna">
        <section className="mon-ctl-panel mon-insumos-tarjeta" aria-label="Llave de cruce">
          <div className="mon-insumos-fila">
            <strong>Llave de cruce</strong>
            <span className="mon-insumos-estado">{llave.automatica ? "Detección automática" : "Declarada en el proyecto"}</span>
          </div>
          <div className="mon-llave-pares">
            <Columnas titulo="Columna en la base" columnas={llave.base} />
            <Columnas titulo="Columna en las respuestas" columnas={llave.respuestas} />
          </div>
          <dl className="mon-llave-ejemplos">
            <div><dt>Ejemplo en la base</dt><dd><code>{ejemplos.base.join(", ") || "—"}</code></dd></div>
            <div><dt>Ejemplo en las respuestas</dt><dd><code>{ejemplos.respuestas.join(", ") || "—"}</code></dd></div>
            <div><dt>Distintos en la base</dt><dd className="is-num">{n(ejemplos.distintosEnLaBase)}</dd></div>
          </dl>
          <p>Las columnas de la llave no se editan desde la app.</p>
        </section>

        <section className="mon-ctl-panel mon-insumos-tarjeta" aria-label="Cruce con la base">
          <strong>Cruce de las efectivas con la base</strong>
          {cruce.total ? (
            <div className="mon-llave-cruce">
              <ul className="mon-llave-pasos">
                <li><span>Coincidencia exacta</span><strong className="is-num">{n(cruce.exacta)}</strong></li>
                <li>
                  <span>Por sus dígitos <small>un código sin prefijo que señala un único caso</small></span>
                  <strong className="is-num">{cruce.normalizada ? `+${n(cruce.normalizada)}` : "0"}</strong>
                </li>
                <li className="is-total"><span>Cruzan con la base</span><strong className="is-num">{n(cruce.cruzan)} de {n(cruce.total)}</strong></li>
              </ul>
              <div className={`mon-llave-tasa${bajo ? " is-bajo" : ""}`}>
                <span className="mon-ctl-antetitulo">Tasa de cruce</span>
                <strong className="is-num">{pctConEspacio((cruce.tasa ?? 0) * 100)}</strong>
                <i aria-hidden="true">
                  <i style={{ width: `${(cruce.tasa ?? 0) * 100}%` }} />
                  <b style={{ left: `${UMBRAL_DE_CRUCE * 100}%` }} />
                </i>
                <small>aviso por debajo del 50 %</small>
              </div>
            </div>
          ) : (
            <p>El corte no trae efectivas para cruzar.</p>
          )}
        </section>

        <section className="mon-ctl-panel mon-llave-filtro" aria-label="Qué cuenta como efectiva">
          {filtro}
          <ul className="mon-llave-fuera">
            {prueba ? <li>{prueba}</li> : null}
            <li>
              Un envío por CodPulso
              {respuestas.repetidos ? `: ${n(respuestas.repetidos)} ${respuestas.repetidos === 1 ? "envío repetido queda fuera" : "envíos repetidos quedan fuera"}.` : "."}
            </li>
          </ul>
        </section>
        <section className="mon-ctl-panel mon-llave-envios" aria-label="Efectivas y su cruce" data-qa-geometry-capacity="owned">
          <header className="mon-insumos-cabecera">
            <strong>Efectivas y su cruce</strong>
            <span>{envios.length ? `${n(envios.length)} envíos que pasan el filtro` : ""}</span>
          </header>
          {envios.length ? (
            <div className="mon-llave-marco">
              <table className="mon-ctl-tabla mon-llave-tabla">
                <thead>
                  <tr>
                    <th scope="col">Código en Kobo</th>
                    <th scope="col">Cómo cruzó</th>
                    <th scope="col">Caso en la hoja</th>
                    <th scope="col">La hoja dice</th>
                    <th scope="col">Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {envios.map((envio, i) => (
                    <tr key={`${envio.codigo}-${envio.responseId}-${i}`} className={`is-${envio.llave}`}>
                      <th scope="row"><code>{envio.codigo}</code></th>
                      <td className="mon-llave-como">{COMO_CRUZO[envio.llave]}</td>
                      <td><code>{envio.codigoEnHoja || "—"}</code></td>
                      <td>{envio.hojaDice || "—"}</td>
                      <td>{envio.responsable || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mon-ctl-nota">Sin efectivas en el corte.</p>
          )}
        </section>
      </div>

      <div className="mon-insumos-lateral">
        <div className="mon-llave-kobo">{tarjetaKobo}</div>
        <section className="mon-ctl-panel mon-llave-revisar" aria-label="Por revisar en la llave" data-qa-geometry-capacity="owned">
          <header className="mon-insumos-cabecera">
            <strong>Por revisar en la llave</strong>
            <span>{porRevisar.length ? n(porRevisar.length) : ""}</span>
            <button type="button" className="mon-insumos-boton" onClick={() => onIrA("control", "respuestas")}>Respuestas</button>
          </header>
          {porRevisar.length ? (
            <ul className="mon-llave-lista">
              {porRevisar.map((item, i) => (
                <li key={`${item.codigo}-${i}`} className={`is-${item.llave}`}>
                  <code>{item.codigo}</code>
                  <span>{COMO_CRUZO[item.llave]}</span>
                  <small>{item.lectura}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mon-ctl-nota">Todas las efectivas cruzan tal cual con la hoja.</p>
          )}
        </section>
      </div>
    </div>
  );
}
