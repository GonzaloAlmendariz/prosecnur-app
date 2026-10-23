import { useMemo } from "react";
import { NotaDelModo } from "../../../core/NotaDelModo";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { casosPorRevisar, construirAvisos, porDestino, type Aviso, type NivelDeAviso } from "./avisosModel";
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
  const destinos = useMemo(() => porDestino(modelo.avisos), [modelo.avisos]);
  const porRevisar = useMemo(() => casosPorRevisar(modelo.avisos), [modelo.avisos]);
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
      {/* La columna crece con su contenido y desplaza si no cabe: las filas no
        * reparten el alto del panel. Lo que sobra con pocas causas lo usa
        * «Por dónde se corrige». */}
      <div className="mon-avisos-columna">
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
                  <tr key={aviso.id} className={`is-${aviso.nivel}${activo ? " is-activo" : ""}`} aria-current={activo ? "true" : undefined} data-aviso={aviso.codigo}>
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
      {destinos.length ? (
        <section className="mon-ctl-panel mon-avisos-destinos" aria-label="Por dónde se corrige">
          <span className="mon-ctl-antetitulo">Por dónde se corrige</span>
          <ul>
            {destinos.map((destino) => (
              <li key={destino.etiqueta}>
                <span>
                  <b>{destino.etiqueta}</b>
                  <small>{destino.avisos === 1 ? "1 aviso" : `${n(destino.avisos)} avisos`}</small>
                </span>
                <strong className="is-num">
                  {[
                    destino.casos ? `${n(destino.casos)} ${destino.casos === 1 ? "caso" : "casos"}` : "",
                    destino.responsables ? `${n(destino.responsables)} ${destino.responsables === 1 ? "responsable" : "responsables"}` : "",
                  ].filter(Boolean).join(" y ") || "—"}
                </strong>
                {destino.direccion ? (
                  <button
                    type="button"
                    className="mon-avisos-ir"
                    onClick={() => {
                      const direccion = destino.direccion;
                      if (direccion) onIrA(direccion.seccion, direccion.pestana);
                    }}
                  >
                    Ir
                  </button>
                ) : <em>fuera de la app</em>}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {/* Crece hasta el pie: con pocos avisos usa el alto con los casos; con
        * muchos queda más bajo y desplaza dentro. */}
      <section className="mon-ctl-panel mon-avisos-por-revisar" aria-label="Casos por revisar" data-qa-geometry-capacity="owned">
        <header className="mon-avisos-por-revisar-cabecera">
          <span className="mon-ctl-antetitulo">Casos por revisar</span>
          <span>{porRevisar.length ? `${n(porRevisar.length)} ${porRevisar.length === 1 ? "caso nombrado" : "casos nombrados"} por los avisos` : ""}</span>
        </header>
        {porRevisar.length ? (
          <div className="mon-avisos-por-revisar-marco">
            <table className="mon-ctl-tabla mon-avisos-por-revisar-tabla">
              <thead>
                <tr>
                  <th scope="col">CodPulso</th>
                  <th scope="col">Aviso</th>
                  <th scope="col">Responsable</th>
                  <th scope="col">Se corrige en</th>
                </tr>
              </thead>
              <tbody>
                {porRevisar.map((caso, i) => (
                  <tr key={`${caso.avisoId}-${caso.codigo}-${i}`} className={`is-${caso.nivel}`}>
                    <th scope="row">{caso.codigo}</th>
                    <td>
                      <button type="button" className="mon-avisos-enlace" onClick={() => escribirFoco(caso.avisoId)}>{caso.aviso}</button>
                    </td>
                    <td>{caso.responsable || "Sin asignar"}</td>
                    <td>{caso.destino}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <NotaDelModo tono="neutro" className="mon-avisos-sin-casos">Los avisos de este corte no nombran casos: se revisan en su destino.</NotaDelModo>
        )}
      </section>
      </div>

      <aside className="mon-ctl-panel mon-avisos-ficha" aria-label="Aviso elegido" data-qa-geometry-group="telefonico-avisos-ficha" data-qa-geometry-contract="intrinsic">
        {elegido ? (
          <>
            <span className="mon-avisos-ficha-cabecera" data-aviso={elegido.codigo}>
              <em className={`mon-avisos-nivel is-${elegido.nivel}`}>{NIVEL[elegido.nivel]}</em>
              <span>{elegido.destino.etiqueta}</span>
            </span>
            <h3>{elegido.titulo}</h3>
            <strong className="mon-avisos-ficha-cifra is-num">
              {n(elegido.casos)}
              <span> {elegido.unidad === "responsables" ? (elegido.casos === 1 ? "responsable" : "responsables") : elegido.casos === 1 ? "caso" : "casos"}</span>
            </strong>
            <p>{elegido.detalle || "Sin detalle en el corte."}</p>
            <section className="mon-avisos-afectados" aria-label={elegido.afectados.length ? "Casos afectados" : "Desglose"}>
              <span className="mon-ctl-antetitulo">
                {elegido.afectados.length ? `Casos afectados (${n(elegido.afectados.length)})` : "Desglose"}
              </span>
              {elegido.afectados.length ? (
                <ul className={`mon-avisos-lista-casos${elegido.afectados.length > 8 ? " is-larga" : ""}`}>
                  {elegido.afectados.map((caso, i) => (
                    <li key={`${caso.codigo}-${i}`}>
                      <b>{caso.codigo}</b>
                      <span>{caso.responsable || "Sin asignar"}</span>
                      <span className="is-num">{caso.fecha ? caso.fecha.replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, "$3/$2") : ""}</span>
                      <small>{caso.nota}</small>
                    </li>
                  ))}
                </ul>
              ) : elegido.desglose.length ? (
                <ul className="mon-avisos-lista-casos is-desglose">
                  {elegido.desglose.map((linea, i) => (
                    <li key={`${linea.etiqueta}-${i}`}>
                      <span>{linea.etiqueta}</span>
                      {linea.valor != null ? <strong className="is-num">{n(linea.valor)}</strong> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <NotaDelModo tono="neutro" className="mon-avisos-sin-casos">El corte no nombra los casos de este aviso: se revisan en {elegido.destino.etiqueta}.</NotaDelModo>
              )}
            </section>
            {/* «Qué hacer» va pegado a la lista: sin hueco en medio. */}
            <section className="mon-avisos-que-hacer" aria-label="Qué hacer">
              <span className="mon-ctl-antetitulo">Qué hacer</span>
              {elegido.destino.direccion ? (
                <>
                  <p>Se revisa en {elegido.destino.etiqueta}.</p>
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
                </>
              ) : (
                <p>Se corrige en la hoja del equipo; Monitoreo la lee al actualizar.</p>
              )}
            </section>
          </>
        ) : (
          <NotaDelModo tono="neutro">Sin avisos por causa; queda sólo el reparto pendiente.</NotaDelModo>
        )}
      </aside>
    </div>
  );
}
