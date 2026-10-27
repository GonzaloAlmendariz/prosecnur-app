import { useMemo } from "react";
import { NotaDelModo } from "../../../core/NotaDelModo";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { casosPorRevisar, construirAvisos, porDestino, type Aviso, type NivelDeAviso } from "./avisosModel";
import { RotuloDePestana, useHayRotulo } from "../navegacion/RotuloDePestana";
import "./controlTelefonico.css";

const NIVEL: Record<NivelDeAviso, string> = { alta: "Alta", media: "Media", baja: "Baja" };

/** «23/10», venga la fecha como 2026-10-23 o como 23/10/2026. */
function fechaCortaDeAviso(fecha: string) {
  if (!fecha) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (iso) return `${iso[3]}/${iso[2]}`;
  const dma = /^(\d{1,2})\/(\d{1,2})\/\d{2,4}/.exec(fecha);
  if (dma) return `${dma[1].padStart(2, "0")}/${dma[2].padStart(2, "0")}`;
  return fecha;
}

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
  corte,
  onIrA,
}: {
  reports: MonitoreoAcreditacionReports;
  /** Corte (`synced_at`) contra el que se cuentan los días sin barrer. */
  corte?: string | null;
  onIrA: (seccion: string, pestana: string) => void;
}) {
  const modelo = useMemo(() => construirAvisos(reports, corte), [reports, corte]);
  const destinos = useMemo(() => porDestino(modelo.avisos), [modelo.avisos]);
  const porRevisar = useMemo(() => casosPorRevisar(modelo.avisos), [modelo.avisos]);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const elegido: Aviso | null = modelo.avisos.find((aviso) => aviso.id === foco) ?? modelo.avisos[0] ?? null;
  const hayRotulo = useHayRotulo();

  if (!modelo.avisos.length && !modelo.sinAsignar) {
    return (
      <section className="mon-ctl-panel mon-avisos-vacio" aria-label="Avisos">
        {hayRotulo ? <RotuloDePestana /> : <span className="mon-ctl-antetitulo">Avisos</span>}
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
        {/* §2a-bis: el rótulo de la pestaña encabeza su primera tarjeta. */}
        {hayRotulo ? <header className="mon-ctl-panel-cabecera mon-avisos-lista-cabecera"><RotuloDePestana /></header> : null}
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
                      {/* Una fila por causa (Meta B, L28): el detalle va en el tooltip y en la ficha. */}
                      <button type="button" className="mon-avisos-causa" title={aviso.detalle} onClick={() => escribirFoco(aviso.id)}>
                        <i aria-hidden="true" />
                        <span>
                          <b>{aviso.titulo}</b>
                          <em className={`mon-avisos-nivel is-${aviso.nivel}`}>{NIVEL[aviso.nivel]}</em>
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
                    <span className="mon-avisos-causa is-inerte" title={modelo.sinAsignar.detalle}>
                      <i aria-hidden="true" />
                      <span>
                        <b>Casos sin asignar</b>
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
      {/* Con hasta ocho casos la tarjeta mide sus filas (sin hueco al pie);
        * con más crece hasta el pie y desplaza dentro. */}
      <section className={`mon-ctl-panel mon-avisos-por-revisar${porRevisar.length <= 8 ? " is-pocos" : ""}`} aria-label="Casos por revisar" data-qa-geometry-capacity="owned">
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
                      <span className="is-num mon-avisos-fecha">{fechaCortaDeAviso(caso.fecha)}</span>
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
                <p title="Monitoreo la lee al actualizar">Se corrige en la hoja del equipo</p>
              )}
            </section>
          </>
        ) : (
          <NotaDelModo tono="neutro">Sin avisos por causa</NotaDelModo>
        )}
      </aside>
    </div>
  );
}
