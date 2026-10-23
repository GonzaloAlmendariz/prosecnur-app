import { memo, useMemo, useState } from "react";
import { Inbox, X } from "lucide-react";
import type { MonitoreoState, MonitoreoTerritorialDashboard, MonitoreoTerritorialPhase } from "../../../../../api/client";
import { usePanelDireccionable } from "../../../../../lib/navegacion/paneles";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { fmt } from "../rotulos";
import {
  construirBandeja,
  escalaDelEsquema,
  esMotivoDeBandeja,
  filtrarBandeja,
  type CasoDeBandeja,
} from "./bandejaModel";
import { DialogoDeAnulacion, PANEL_ANULAR } from "./DialogoDeAnulacion";
import "./bandeja.css";

type Vista = "bandeja" | "anulados";

/**
 * Control › Bandeja (territorial.md §3.6): filtros por motivo y distrito a la
 * izquierda (el motivo viaja en `foco`: `…&pestana=bandeja&foco=gps-lejos`),
 * la tabla de casos al centro y el inspector del caso a la derecha, con el
 * esquema de distancia a su manzana y «Anular caso» (P2, `panel=anular`).
 *
 * «Aprobar observación» no se dibuja: la config guarda las aprobaciones, pero
 * el motor no las aplica (ver el plan, T4).
 */
function BandejaTabImpl({
  consultas,
  phase,
  onStateChange,
}: {
  consultas: MonitoreoTerritorialDashboard | null;
  phase: MonitoreoTerritorialPhase;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const modelo = useMemo(() => construirBandeja(consultas), [consultas]);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const motivo = esMotivoDeBandeja(foco) ? foco : null;
  const [distrito, setDistrito] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("bandeja");
  const [elegidoId, setElegido] = useState<string | null>(null);
  const anular = usePanelDireccionable(PANEL_ANULAR);
  const filas = useMemo(() => filtrarBandeja(modelo.casos, motivo, distrito), [distrito, modelo.casos, motivo]);
  const elegido = filas.find((caso) => caso.id === elegidoId) ?? null;
  const pedido = useMemo(
    () => (elegido?.responseId ? { alcance: "caso" as const, responseId: elegido.responseId, rotulo: `Caso ${elegido.responseId.slice(0, 8)}, UMP ${elegido.ump}` } : null),
    [elegido],
  );

  if (!modelo.disponible) {
    return (
      <section className="mon-ban mon-ban--vacio" data-audit-ready="vacio:sin-bandeja" aria-label="Bandeja">
        <div className="mon-ban-panel mon-ban-vacio">
          <Inbox size={20} aria-hidden="true" />
          <strong>La bandeja se está preparando</strong>
          <span>Los casos por revisar llegan con el corte de Consultas.</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`mon-ban${elegido ? " con-inspector" : ""}`}
      aria-label="Bandeja"
      data-audit-ready="monitoreo-territorial-control-bandeja"
      data-qa-geometry-group="territorial-bandeja"
      data-qa-geometry-contract="intrinsic"
    >
      <aside className="mon-ban-panel mon-ban-filtros" aria-label="Filtros de la bandeja" data-qa-geometry-member="filtros">
        <h3 className="mon-ban-subtitulo">Motivo</h3>
        <ul className="mon-ban-lista-filtros">
          <li>
            <button type="button" aria-pressed={!motivo} onClick={() => escribirFoco(null)}>
              <span>Todos</span><b>{fmt(modelo.casos.length)}</b>
            </button>
          </li>
          {modelo.filtros.map((filtro) => (
            <li key={filtro.clave}>
              <button type="button" aria-pressed={motivo === filtro.clave} onClick={() => escribirFoco(motivo === filtro.clave ? null : filtro.clave)}>
                <span>{filtro.rotulo}</span><b>{fmt(filtro.casos)}</b>
              </button>
            </li>
          ))}
        </ul>
        <h3 className="mon-ban-subtitulo">Distrito</h3>
        <ul className="mon-ban-lista-filtros">
          <li>
            <button type="button" aria-pressed={!distrito} onClick={() => setDistrito(null)}>
              <span>Todos</span><b>{fmt(modelo.casos.length)}</b>
            </button>
          </li>
          {modelo.distritos.map((item) => (
            <li key={item.distrito}>
              <button type="button" aria-pressed={distrito === item.distrito} onClick={() => setDistrito(distrito === item.distrito ? null : item.distrito)}>
                <span>{item.distrito}</span><b>{fmt(item.casos)}</b>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="mon-ban-panel mon-ban-tabla-panel" aria-labelledby="mon-ban-titulo" data-qa-geometry-member="tabla">
        <header className="mon-ban-cabecera">
          <h3 id="mon-ban-titulo" className="pulso-sr-only">Casos de la bandeja</h3>
          <span className="mon-ban-segmentado" role="group" aria-label="Qué casos ver">
            <button type="button" aria-pressed={vista === "bandeja"} className={vista === "bandeja" ? "is-active" : ""} onClick={() => setVista("bandeja")}>
              En bandeja <b>{fmt(modelo.casos.length)}</b>
            </button>
            <button type="button" aria-pressed={vista === "anulados"} className={vista === "anulados" ? "is-active" : ""} onClick={() => setVista("anulados")}>
              Anulados <b>{fmt(modelo.anulados.length)}</b>
            </button>
          </span>
          {vista === "bandeja" && (motivo || distrito) ? (
            <span className="mon-ban-base">{fmt(filas.length)} de {fmt(modelo.casos.length)} con el filtro</span>
          ) : null}
        </header>
        <div className="mon-ban-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Casos, con desplazamiento">
          {vista === "anulados" ? (
            <TablaDeAnulados anulados={modelo.anulados} />
          ) : filas.length ? (
            <table className="mon-ban-tabla">
              <thead>
                <tr>
                  <th scope="col">Caso</th>
                  <th scope="col">Día</th>
                  <th scope="col">Distrito</th>
                  <th scope="col">UMP</th>
                  <th scope="col">Aplicador</th>
                  <th scope="col">Motivo</th>
                  <th scope="col" className="is-num">Distancia</th>
                  <th scope="col" className="is-num">Duración</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((caso) => (
                  <tr key={caso.id} className={elegido?.id === caso.id ? "is-elegido" : ""}>
                    <th scope="row">
                      <button type="button" aria-pressed={elegido?.id === caso.id} aria-label={`Caso ${caso.responseId.slice(0, 8) || caso.id}: ${caso.rotuloDeMotivo}`} onClick={() => setElegido(elegido?.id === caso.id ? null : caso.id)}>
                        {caso.responseId.slice(0, 8) || caso.id}
                      </button>
                    </th>
                    <td>{caso.dia}{caso.hora ? ` ${caso.hora}` : ""}</td>
                    <td>{caso.distrito}</td>
                    <td>{caso.ump || "—"}</td>
                    <td>{caso.aplicador}</td>
                    <td>{caso.rotuloDeMotivo}</td>
                    <td className="is-num">{caso.distancia}</td>
                    <td className="is-num">{caso.duracion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mon-ban-sin-casos">Sin casos en esta cola.</p>
          )}
        </div>
      </section>

      {elegido && vista === "bandeja" ? (
        <InspectorDeCaso caso={elegido} onCerrar={() => setElegido(null)} onAnular={pedido ? anular.abrir : null} />
      ) : null}

      {anular.abierto && pedido ? (
        <DialogoDeAnulacion pedido={pedido} phase={phase} panel={anular.props} onCerrar={anular.cerrar} onAplicada={(state) => onStateChange?.(state)} />
      ) : null}
    </section>
  );
}

function TablaDeAnulados({ anulados }: { anulados: ReturnType<typeof construirBandeja>["anulados"] }) {
  if (!anulados.length) return <p className="mon-ban-sin-casos">Ningún caso anulado uno a uno.</p>;
  return (
    <table className="mon-ban-tabla">
      <thead>
        <tr>
          <th scope="col">Caso</th>
          <th scope="col">Anulado el</th>
          <th scope="col">Motivo</th>
        </tr>
      </thead>
      <tbody>
        {anulados.map((item) => (
          <tr key={item.id}>
            <th scope="row">{item.rotulo}</th>
            <td>{item.dia || "—"}</td>
            <td>{item.motivo || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EsquemaDeDistancia({ metros }: { metros: number | null }) {
  const { radioMaximo, anillos } = escalaDelEsquema(metros);
  const centro = 80;
  const escala = 70 / radioMaximo;
  const angulo = -Math.PI / 4;
  return (
    <svg className="mon-ban-esquema" viewBox="0 0 160 160" role="img" aria-label={metros == null ? "Sin GPS" : `A ${fmt(Math.round(metros))} m de su manzana`}>
      {anillos.map((radio) => (
        <g key={radio}>
          <circle cx={centro} cy={centro} r={radio * escala} className={radio === 300 ? "is-300" : "is-150"} />
          <text x={centro} y={centro - radio * escala - 3} textAnchor="middle">{fmt(radio)} m</text>
        </g>
      ))}
      <rect x={centro - 5} y={centro - 5} width={10} height={10} className="mon-ban-esquema-manzana" />
      {metros != null ? (
        <circle cx={centro + Math.cos(angulo) * metros * escala} cy={centro + Math.sin(angulo) * metros * escala} r={5} className="mon-ban-esquema-caso" />
      ) : null}
    </svg>
  );
}

function InspectorDeCaso({ caso, onCerrar, onAnular }: { caso: CasoDeBandeja; onCerrar: () => void; onAnular: (() => void) | null }) {
  return (
    <aside className="mon-ban-panel mon-ban-inspector" aria-labelledby="mon-ban-inspector-titulo" data-qa-geometry-member="inspector">
      <header className="mon-ban-inspector-cabecera">
        <div>
          <h3 id="mon-ban-inspector-titulo">Caso {caso.responseId.slice(0, 8) || caso.id}</h3>
          <span className="mon-ban-base">{caso.distrito}, UMP {caso.ump || "—"}{caso.manzana ? ` (manzana ${caso.manzana})` : ""}</span>
          <span className="mon-ban-base">{caso.aplicador} · {caso.dia} {caso.hora}</span>
        </div>
        <button type="button" className="mon-ban-cerrar" aria-label="Cerrar el caso" onClick={onCerrar}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <section aria-label="Distancia a su manzana">
        <h4 className="mon-ban-subtitulo">Distancia a su manzana</h4>
        <EsquemaDeDistancia metros={caso.distanciaM} />
        <p className="mon-ban-base">Esquema sin coordenadas: el caso a {caso.distancia === "Sin GPS" ? "una distancia desconocida" : caso.distancia} de su manzana.</p>
      </section>
      <section aria-label="Señales del caso">
        <h4 className="mon-ban-subtitulo">Señal</h4>
        <p className="mon-ban-senal">{caso.rotuloDeMotivo}{caso.duracion !== "—" ? ` · duró ${caso.duracion}` : ""}</p>
      </section>
      <footer className="mon-ban-pie">
        {onAnular ? (
          <button type="button" className="mon-ban-boton is-peligro" onClick={onAnular}>Anular caso</button>
        ) : (
          <p className="mon-ban-base">Este caso no trae identificador de respuesta y no se puede anular desde aquí.</p>
        )}
      </footer>
    </aside>
  );
}

export const BandejaTab = memo(BandejaTabImpl);
