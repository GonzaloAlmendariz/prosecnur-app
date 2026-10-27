import { useMemo } from "react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { pctConEspacio } from "../../../core/formatoComun";
import { usePanelDireccionable, type PanelDeclarado } from "../../../../../lib/navegacion/paneles";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { resumenDeEquipo } from "../conteoDeEquipo";
import { EquipoMatriz } from "./EquipoMatriz";
import { FAMILIAS_DEL_CLIENTE, rotuloDeRegla } from "./familiasDelCliente";
import { construirEquipo, familiasDe, statusDe, type Equipo as Modelo, type OperadorDeEquipo } from "./equipoModel";
import "./controlTelefonico.css";
import { RotuloDePestana, useHayRotulo } from "../navegacion/RotuloDePestana";

/** «Estados por operador» es una vista de la pestaña con dirección: `panel=estados`. */
export const PANEL_ESTADOS: PanelDeclarado = { id: "estados", label: "Estados por operador", clase: "inspector" };

const ETIQUETA = new Map(FAMILIAS_DEL_CLIENTE.map((item) => [item.id, item.etiqueta]));

function n(valor: number | null | undefined) {
  return valor == null ? "—" : valor.toLocaleString("es-PE");
}

function TablaDeCarga({
  modelo,
  elegido,
  onElegir,
}: {
  modelo: Modelo;
  elegido: string | null;
  onElegir: (nombre: string) => void;
}) {
  const maximo = Math.max(1, ...modelo.operadores.map((op) => op.asignados));
  return (
    <div className="mon-ctl-tabla-marco">
      <table className="mon-ctl-tabla">
        <thead>
          <tr>
            <th scope="col">Operador</th>
            <th scope="col" className="is-num">Asignados</th>
            <th scope="col">Llamados</th>
            <th scope="col" className="is-num">Sin llamar</th>
            <th scope="col" className="is-num">Efect. hoja</th>
            <th scope="col" className="is-num">Efect. Kobo</th>
            <th scope="col" className="is-num" title="Efectivas de Kobo cruzadas al caso que la hoja no marca efectivas">Brecha</th>
            <th scope="col" className="is-num">Sin efectiva</th>
            <th scope="col" className="is-num" title="Promedio de intentos entre sus casos que se pueden reintentar">Intentos por caso</th>
          </tr>
        </thead>
        <tbody>
          {modelo.operadores.map((op) => {
            const activo = op.nombre === elegido;
            const altoSinLlamar = op.asignados > 0 && op.sinLlamar / op.asignados >= 0.6;
            return (
              <tr key={op.nombre} className={activo ? "is-activo" : undefined} aria-current={activo ? "true" : undefined}>
                <th scope="row"><button type="button" onClick={() => onElegir(op.nombre)}>{op.nombre}</button></th>
                <td className="is-num">{n(op.asignados)}</td>
                <td className="mon-equipo-llamados">
                  <i aria-hidden="true"><b style={{ width: `${(op.llamados / maximo) * 100}%` }} /></i>
                  <span className="is-num">{n(op.llamados)}</span>
                </td>
                <td className={`is-num mon-equipo-sin-llamar${altoSinLlamar ? " is-alto" : ""}`}>{n(op.sinLlamar)}</td>
                <td className="is-num">{n(op.efectivasHoja)}</td>
                <td className="is-num">{n(op.efectivasKobo)}</td>
                <td className={`is-num${op.brecha ? " mon-equipo-brecha" : ""}`}>{op.brecha ? `+${n(op.brecha)}` : "0"}</td>
                <td className="is-num">{pctConEspacio(op.pctSinEfectiva)}</td>
                <td className="is-num">{op.promedioIntentos == null ? "—" : op.promedioIntentos.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
              </tr>
            );
          })}
          {modelo.sinAsignar ? (
            <tr className="is-sin-asignar">
              <th scope="row" title="Casos sin responsable en la hoja">Sin asignar</th>
              <td className="is-num">{n(modelo.sinAsignar.asignados)}</td>
              <td className="is-num">—</td>
              <td className="is-num">{n(modelo.sinAsignar.asignados)}</td>
              <td className="is-num">0</td>
              <td className="is-num">{n(modelo.sinAsignar.efectivasKobo)}</td>
              <td className="is-num">—</td>
              <td className="is-num">—</td>
              <td className="is-num">—</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function FichaDelOperador({ operador, modelo }: { operador: OperadorDeEquipo | null; modelo: Modelo }) {
  if (!operador) {
    return (
      <aside className="mon-ctl-panel mon-equipo-ficha" aria-label="Ficha del operador">
        <span className="mon-ctl-antetitulo">Operador</span>
        <p>Elige un operador de la tabla.</p>
      </aside>
    );
  }
  const familias = familiasDe(modelo, operador.nombre);
  const total = familias.reduce((suma, item) => suma + item.casos, 0) || 1;
  const orden = FAMILIAS_DEL_CLIENTE.map((item) => item.id);
  const ordenadas = [...familias].sort((a, b) => orden.indexOf(a.familia) - orden.indexOf(b.familia));
  const estados = statusDe(modelo, operador.nombre);
  const iniciales = operador.nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toLocaleUpperCase("es")).join("");
  const casosEnStatus = estados.reduce((suma, item) => suma + item.casos, 0);
  // §2a-bis: cada unidad de lectura en su tarjeta — cifras en baldosas, y
  // familias, insistencia y status en bloques con su cabecera.
  return (
    <aside className="mon-ctl-panel mon-equipo-ficha" aria-label={`Ficha de ${operador.nombre}`}>
      <header className="mon-equipo-ficha-titulo">
        <span className="mon-equipo-avatar" aria-hidden="true">{iniciales}</span>
        <span>
          <span className="mon-ctl-antetitulo">Operador</span>
          <b>{operador.nombre}</b>
        </span>
      </header>
      <div className="mon-equipo-cifras">
        <span className="mon-equipo-baldosa">
          <span className="mon-ctl-antetitulo">Asignados</span>
          <b className="is-num">{n(operador.asignados)}</b>
          <small>casos de la hoja</small>
        </span>
        <span className="mon-equipo-baldosa">
          <span className="mon-ctl-antetitulo">Llamados</span>
          <b className="is-num">{n(operador.llamados)}</b>
          <small>{pctConEspacio(operador.asignados ? (operador.llamados / operador.asignados) * 100 : null)} de asignados</small>
        </span>
        <span className="mon-equipo-baldosa is-efectiva">
          <span className="mon-ctl-antetitulo">Efectivas</span>
          <b className="is-num">{n(operador.efectivasHoja)}</b>
          <small>Kobo {n(operador.efectivasKobo)}</small>
        </span>
      </div>
      {familias.length ? (
        <section className="mon-equipo-bloque" aria-label="Casos asignados por familia">
          <header className="mon-equipo-bloque-cabecera">
            <span className="mon-ctl-antetitulo">Casos por familia</span>
            <small>{n(total)} casos</small>
          </header>
          <span className="mon-equipo-familias-barra" aria-hidden="true">
            {ordenadas.map((item) => (
              <i key={item.familia} className={`is-${item.familia}`} style={{ width: `${(item.casos / total) * 100}%` }} />
            ))}
          </span>
          <dl className="mon-equipo-familias-leyenda">
            {ordenadas.map((item) => (
              <div key={item.familia} className={`is-${item.familia}`}>
                <dt><i aria-hidden="true" />{ETIQUETA.get(item.familia)}</dt>
                <dd>{n(item.casos)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      <section className="mon-equipo-bloque" aria-label="Insistencia y registro">
        <header className="mon-equipo-bloque-cabecera">
          <span className="mon-ctl-antetitulo">Insistencia y registro</span>
        </header>
        <dl className="mon-equipo-datos">
          <div><dt>Casos que se pueden reintentar</dt><dd>{n(operador.reintentables)}</dd></div>
          <div><dt>No contesta</dt><dd>{n(operador.noContesta)}</dd></div>
          <div><dt>Intentos por caso reintentable</dt><dd>{operador.promedioIntentos == null ? "—" : operador.promedioIntentos.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</dd></div>
          <div><dt>Sin efectiva entre los llamados</dt><dd>{pctConEspacio(operador.pctSinEfectiva)}</dd></div>
          <div className={operador.brecha ? "is-alerta" : undefined}><dt>Efectivas en Kobo sin marcar en la hoja</dt><dd>{n(operador.brecha)}</dd></div>
        </dl>
      </section>
      <section className="mon-equipo-bloque mon-equipo-status" aria-label="Status en la hoja">
        <header className="mon-equipo-bloque-cabecera">
          <span className="mon-ctl-antetitulo">Status en la hoja</span>
          <small>{n(casosEnStatus)} casos</small>
        </header>
        <ul>
          {estados.map((item) => (
            <li key={item.status} className={`is-${item.familia}`}>
              <span className="mon-equipo-status-nombre">
                <span>{item.status}</span>
                {item.porRegla ? <em className="mon-ctl-por-regla">{rotuloDeRegla(item.familia)}</em> : null}
              </span>
              <i aria-hidden="true"><b style={{ width: `${(item.casos / total) * 100}%` }} /></i>
              <strong className="is-num">{n(item.casos)}</strong>
            </li>
          ))}
        </ul>
        {estados.length === 1 ? (
          <p className="mon-equipo-status-unico">Sus {n(estados[0].casos)} casos están en «{estados[0].status}».</p>
        ) : null}
      </section>
    </aside>
  );
}

/**
 * Control › Equipo: cómo rinde cada responsable. «Carga» con la producción y
 * la brecha frente a Kobo; «Estados por operador» con la matriz de desvíos.
 * A la derecha, la ficha del operador elegido (`foco`). Sin acciones: la
 * asignación se cambia en la hoja del equipo.
 */
export function Equipo({
  reports,
  state,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
}) {
  const reglas = state?.config?.operational_model?.state_rules;
  const modelo = useMemo(() => construirEquipo({ reports, reglas: reglas ?? [] }), [reports, reglas]);
  const panel = usePanelDireccionable(PANEL_ESTADOS);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const elegido = modelo.operadores.find((op) => op.nombre === foco) ?? modelo.operadores[0] ?? null;
  const equipo = resumenDeEquipo(modelo.operadores.map((op) => op.nombre));
  const hayRotulo = useHayRotulo();

  return (
    <div className="mon-equipo" data-qa-geometry-group="telefonico-control-equipo" data-qa-geometry-contract="intrinsic">
      <section className="mon-ctl-panel mon-equipo-tabla-panel" aria-label="Rendimiento del equipo" {...panel.props}>
        {/* §2a-bis: el rótulo de la pestaña, con sus chips, encabeza la tarjeta; debajo, su vista. */}
        {hayRotulo ? <header className="mon-ctl-panel-cabecera mon-tel-cabecera-rotulo"><RotuloDePestana /></header> : null}
        <header className="mon-ctl-panel-cabecera">
          <b>{panel.abierto ? "Estados por operador" : "Carga por operador"}</b>
          <span>{equipo.etiqueta}</span>
          <div className="mon-tel-subvistas mon-equipo-vistas" role="group" aria-label="Vista del equipo">
            <button type="button" className={`mon-tel-subvista${panel.abierto ? "" : " is-active"}`} aria-pressed={!panel.abierto} onClick={panel.cerrar}>Carga</button>
            <button type="button" className={`mon-tel-subvista${panel.abierto ? " is-active" : ""}`} aria-pressed={panel.abierto} onClick={panel.abrir}>Estados por operador</button>
          </div>
        </header>
        {panel.abierto ? (
          <EquipoMatriz matriz={modelo.matriz} elegido={elegido?.nombre ?? null} onElegir={(nombre) => escribirFoco(nombre)} />
        ) : (
          // Qué es «Brecha» e «Intentos por caso» va en el tooltip de su columna, no en un pie «rótulo: comentario».
          <TablaDeCarga modelo={modelo} elegido={elegido?.nombre ?? null} onElegir={(nombre) => escribirFoco(nombre)} />
        )}
      </section>
      <FichaDelOperador operador={elegido} modelo={modelo} />
    </div>
  );
}
