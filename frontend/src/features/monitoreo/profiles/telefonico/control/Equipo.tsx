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
            <th scope="col" className="is-num">Brecha</th>
            <th scope="col" className="is-num">Sin efectiva</th>
            <th scope="col" className="is-num">Intentos por caso</th>
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
              <th scope="row">Sin asignar</th>
              <td className="is-num">{n(modelo.sinAsignar.asignados)}</td>
              <td>Casos sin responsable en la hoja</td>
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
  return (
    <aside className="mon-ctl-panel mon-equipo-ficha" aria-label={`Ficha de ${operador.nombre}`}>
      <span className="mon-equipo-ficha-titulo">
        <span className="mon-ctl-antetitulo">Operador</span>
        <b>{operador.nombre}</b>
      </span>
      <div className="mon-equipo-cifras">
        <span><span className="mon-ctl-antetitulo">Asignados</span><b className="is-num">{n(operador.asignados)}</b></span>
        <span>
          <span className="mon-ctl-antetitulo">Llamados</span>
          <b className="is-num">{n(operador.llamados)}</b>
          <small>{pctConEspacio(operador.asignados ? (operador.llamados / operador.asignados) * 100 : null)}</small>
        </span>
        <span>
          <span className="mon-ctl-antetitulo">Efectivas</span>
          <b className="is-num">{n(operador.efectivasHoja)}</b>
          <small>Kobo {n(operador.efectivasKobo)}</small>
        </span>
      </div>
      {familias.length ? (
        <section className="mon-equipo-bloque" aria-label="Casos asignados por familia">
          <span className="mon-ctl-antetitulo">Casos asignados por familia</span>
          <span className="mon-equipo-familias-barra" aria-hidden="true">
            {ordenadas.map((item) => (
              <i key={item.familia} className={`is-${item.familia}`} style={{ width: `${(item.casos / total) * 100}%` }} />
            ))}
          </span>
          <dl className="mon-equipo-familias-leyenda">
            {ordenadas.map((item) => (
              <div key={item.familia}><dt>{ETIQUETA.get(item.familia)}</dt><dd>{n(item.casos)}</dd></div>
            ))}
          </dl>
        </section>
      ) : null}
      <section className="mon-equipo-bloque" aria-label="Insistencia y registro">
        <span className="mon-ctl-antetitulo">Insistencia y registro</span>
        <dl className="mon-equipo-datos">
          <div><dt>Casos que se pueden reintentar</dt><dd>{n(operador.reintentables)}</dd></div>
          <div><dt>No contesta</dt><dd>{n(operador.noContesta)}</dd></div>
          <div><dt>Intentos por caso reintentable</dt><dd>{operador.promedioIntentos == null ? "—" : operador.promedioIntentos.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</dd></div>
          <div><dt>Sin efectiva entre los llamados</dt><dd>{pctConEspacio(operador.pctSinEfectiva)}</dd></div>
          <div><dt>Efectivas en Kobo sin marcar en la hoja</dt><dd>{n(operador.brecha)}</dd></div>
        </dl>
      </section>
      <section className="mon-equipo-bloque mon-equipo-status" aria-label="Status en la hoja">
        <span className="mon-ctl-antetitulo">Status en la hoja</span>
        <ul>
          {statusDe(modelo, operador.nombre).map((item) => (
            <li key={item.status} className={`is-${item.familia}`}>
              <span>
                {item.status}
                {item.porRegla ? <em className="mon-ctl-por-regla">{rotuloDeRegla(item.familia)}</em> : null}
              </span>
              <i aria-hidden="true"><b style={{ width: `${(item.casos / total) * 100}%` }} /></i>
              <strong className="is-num">{n(item.casos)}</strong>
            </li>
          ))}
        </ul>
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

  return (
    <div className="mon-equipo" data-qa-geometry-group="telefonico-control-equipo" data-qa-geometry-contract="intrinsic">
      <section className="mon-ctl-panel mon-equipo-tabla-panel" aria-label="Rendimiento del equipo" {...panel.props}>
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
          <>
            <TablaDeCarga modelo={modelo} elegido={elegido?.nombre ?? null} onElegir={(nombre) => escribirFoco(nombre)} />
            <footer className="mon-equipo-pie">
              Brecha: efectivas de Kobo cruzadas al caso que la hoja no marca efectivas. Intentos por caso: promedio entre sus casos que se pueden reintentar.
            </footer>
          </>
        )}
      </section>
      <FichaDelOperador operador={elegido} modelo={modelo} />
    </div>
  );
}
