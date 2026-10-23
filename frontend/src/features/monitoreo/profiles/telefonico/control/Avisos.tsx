import { useMemo } from "react";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { construirAvisos, type Aviso, type NivelDeAviso } from "./avisosModel";
import "./controlTelefonico.css";

const NIVEL: Record<NivelDeAviso, string> = { alta: "Alta", media: "Media", baja: "Baja" };

function n(valor: number | null | undefined) {
  return valor == null ? "—" : valor.toLocaleString("es-PE");
}

/**
 * Control › Avisos: lo que hay que corregir, por causa, con su nivel, cuántos
 * casos toca y dónde se corrige. El aviso elegido es `foco`. «Casos sin
 * asignar» va aparte y en gris. Sin acciones de escritura: el destino lleva a
 * la pestaña donde se revisa o dice que se corrige en la hoja del equipo.
 */
export function Avisos({
  reports,
  onIrA,
}: {
  reports: MonitoreoAcreditacionReports;
  onIrA: (seccion: string, pestana: string) => void;
}) {
  const modelo = useMemo(() => construirAvisos(reports), [reports]);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const elegido: Aviso | null = modelo.avisos.find((aviso) => aviso.id === foco) ?? modelo.avisos[0] ?? null;

  if (!modelo.avisos.length && !modelo.sinAsignar) {
    return (
      <section className="mon-ctl-panel mon-avisos-vacio" aria-label="Avisos">
        <span className="mon-ctl-antetitulo">Avisos</span>
        <strong>Sin avisos activos</strong>
        <p>La hoja de barrido y las respuestas no muestran nada que corregir en este corte.</p>
      </section>
    );
  }

  return (
    <div className="mon-avisos" data-qa-geometry-group="telefonico-control-avisos" data-qa-geometry-contract="intrinsic">
      <section className="mon-ctl-panel mon-avisos-lista-panel" aria-label="Avisos por causa">
        <div className="mon-ctl-tabla-marco">
          <table className="mon-ctl-tabla mon-avisos-tabla">
            <thead>
              <tr>
                <th scope="col">Causa</th>
                <th scope="col" className="is-num">Cuántos</th>
                <th scope="col">Se corrige en</th>
              </tr>
            </thead>
            <tbody>
              {modelo.avisos.map((aviso) => {
                const activo = aviso.id === elegido?.id;
                return (
                  <tr key={aviso.id} className={`is-${aviso.nivel}${activo ? " is-activo" : ""}`} aria-current={activo ? "true" : undefined}>
                    <th scope="row">
                      <button type="button" className="mon-avisos-causa" onClick={() => escribirFoco(aviso.id)}>
                        <i aria-hidden="true" />
                        <span>
                          <b>{aviso.titulo}</b>
                          <em className={`mon-avisos-nivel is-${aviso.nivel}`}>{NIVEL[aviso.nivel]}</em>
                          <small>{aviso.detalle}</small>
                        </span>
                      </button>
                    </th>
                    <td className="is-num mon-avisos-casos">{n(aviso.casos)}</td>
                    <td>{aviso.destino.etiqueta}</td>
                  </tr>
                );
              })}
              {modelo.sinAsignar ? (
                <tr className="is-sin-asignar">
                  <th scope="row">
                    <span className="mon-avisos-causa is-inerte">
                      <i aria-hidden="true" />
                      <span>
                        <b>Casos sin asignar</b>
                        <small>{modelo.sinAsignar.detalle}</small>
                      </span>
                    </span>
                  </th>
                  <td className="is-num mon-avisos-casos">{n(modelo.sinAsignar.casos)}</td>
                  <td>Hoja del equipo</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="mon-ctl-panel mon-avisos-ficha" aria-label="Aviso elegido">
        {elegido ? (
          <>
            <span className="mon-avisos-ficha-cabecera">
              <em className={`mon-avisos-nivel is-${elegido.nivel}`}>{NIVEL[elegido.nivel]}</em>
              <code>{elegido.codigo}</code>
            </span>
            <h3>{elegido.titulo}</h3>
            <strong className="mon-avisos-ficha-cifra is-num">
              {n(elegido.casos)}
              <span> {elegido.unidad === "responsables" ? (elegido.casos === 1 ? "responsable" : "responsables") : elegido.casos === 1 ? "caso" : "casos"}</span>
            </strong>
            <section className="mon-equipo-bloque">
              <span className="mon-ctl-antetitulo">Detalle</span>
              <p>{elegido.detalle || "Sin detalle en el corte."}</p>
            </section>
            {elegido.desglose.length ? (
              <section className="mon-equipo-bloque mon-avisos-desglose">
                <span className="mon-ctl-antetitulo">Desglose</span>
                <ul>
                  {elegido.desglose.map((linea, i) => (
                    <li key={`${linea.etiqueta}-${i}`}>
                      <span>{linea.etiqueta}</span>
                      {linea.valor != null ? <strong className="is-num">{n(linea.valor)}</strong> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <dl className="mon-equipo-datos">
              {elegido.donde ? <div><dt>Dónde</dt><dd>{elegido.donde}</dd></div> : null}
              {elegido.fuente ? <div><dt>Fuente</dt><dd>{elegido.fuente}</dd></div> : null}
              <div><dt>Se corrige en</dt><dd>{elegido.destino.etiqueta}</dd></div>
            </dl>
            <div className="mon-avisos-ficha-pie">
              {elegido.destino.direccion ? (
                <button
                  type="button"
                  className="mon-avisos-ir"
                  onClick={() => {
                    const direccion = elegido.destino.direccion;
                    if (direccion) onIrA(direccion.seccion, direccion.pestana);
                  }}
                >
                  Ir a {elegido.destino.etiqueta}
                </button>
              ) : (
                <p className="mon-ctl-nota">Se corrige en la hoja del equipo; Monitoreo la lee al actualizar.</p>
              )}
            </div>
          </>
        ) : (
          <p className="mon-ctl-nota">Sin avisos por causa; queda sólo el reparto pendiente.</p>
        )}
      </aside>
    </div>
  );
}
