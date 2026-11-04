import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { esFocoDelEje, focoDesdeTexto } from "../AulasCuotasResumen";
import { fmt, pctPerfil } from "../kpisDeAulas";
import { EstadoChip } from "../../../../../components/EstadoChip";
import { tonoDeEstadoChip } from "../tonoDeEstadoChip";
import {
  claveDeGrupo,
  construirPorFacultad,
  readinessDePorFacultad,
  type CuotaDeLaPestana,
  type Lateral,
  type ModeloPorFacultad,
  type Vacio,
} from "./porFacultadModelo";
import "./porFacultad.css";

/**
 * Avance › Por facultad (Por nivel) de Cursos-horario (ficha A2,
 * `docs/qa/revamp-monitoreo/aulas.md`). ¿Qué grupo no llega?
 *
 * Eje facultad: a la izquierda la cuota por facultad y sexo con «Al cierre»
 * (la proyección del motor, decisión P10) y su lectura; a la derecha, los
 * desenlaces, qué rindió cada tipo de curso-horario y el consumo de la
 * reserva. Otro eje (nivel): la cuota por nivel y a quién se está alcanzando.
 *
 * Altura intrínseca: el desplazamiento es de `.mon-profile-content`, el único
 * dueño de scroll del perfil (C4).
 */
function PorFacultadAulasImpl({ dashboard, cargando, vacioSinTablero }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  /** El vacío del perfil sin tablero (plan sin importar, fuentes, error de lectura). */
  vacioSinTablero: ReactNode;
}) {
  const modelo = useMemo(() => (cargando ? null : construirPorFacultad(dashboard)), [cargando, dashboard]);
  const readiness = readinessDePorFacultad(modelo, cargando);
  const [focoTexto, escribirFoco] = useFocoMonitoreo();

  if (!modelo) return <Silueta readiness={readiness} />;

  if (modelo.estado === "sin-tablero") {
    return (
      <section className="aulas-pf aulas-pf--vacio" aria-label="Avance por grupo" data-audit-ready={readiness}>
        {vacioSinTablero}
      </section>
    );
  }

  const foco = focoDesdeTexto(focoTexto);
  const enFoco = esFocoDelEje(foco, modelo.eje.clave) ? claveDeGrupo(foco?.valor ?? "") : "";
  const tipoDeFoco = modelo.eje.clave === "nivel" ? "nivel" : "facultad";
  const alternarFoco = (valor: string) => {
    const activo = enFoco !== "" && enFoco === claveDeGrupo(valor);
    escribirFoco(activo ? null : `${tipoDeFoco}:${valor}`);
  };

  return (
    <section
      className="aulas-pf"
      aria-label={`Avance ${modelo.rotulo.toLocaleLowerCase("es")}`}
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-porfacultad"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="aulas-pf-izquierda" data-qa-geometry-member="cuota">
        <Cuota
          cuota={modelo.cuota}
          etiquetaEje={modelo.eje.etiqueta}
          procedencia={modelo.procedencia}
          avisoDelEje={modelo.avisoDelEje}
          enFoco={enFoco}
          onFoco={alternarFoco}
        />
      </div>
      <div className="aulas-pf-derecha" data-qa-geometry-member="lateral">
        <LateralDeLaPestana lateral={modelo.lateral} etiquetaEje={modelo.eje.etiqueta} enFoco={enFoco} />
      </div>
    </section>
  );
}

/** S1: la misma silueta mientras se prepara el corte, con el tiempo que lleva. */
function Silueta({ readiness }: { readiness: string }) {
  const segundos = useTranscurrido();
  const reloj = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
  return (
    <section className="aulas-pf aulas-pf--silueta" aria-label="Avance por grupo" aria-busy="true" data-audit-ready={readiness}>
      <div className="aulas-pf-izquierda">
        <div className="aulas-pf-panel aulas-pf-silueta is-cuota">
          <p className="aulas-pf-preparando" role="status">
            Preparando el corte <span className="aulas-pf-num">{reloj}</span>
          </p>
        </div>
      </div>
      <div className="aulas-pf-derecha">
        <div className="aulas-pf-panel aulas-pf-silueta is-franja" />
        <div className="aulas-pf-panel aulas-pf-silueta is-lateral" />
      </div>
    </section>
  );
}

function useTranscurrido() {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const inicio = Date.now();
    const id = window.setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return segundos;
}

function Nota({ vacio }: { vacio: Vacio }) {
  return (
    <p className="aulas-pf-nota" data-qa-geometry-empty={vacio.clase}>
      <Info size={14} aria-hidden="true" />
      <span>{vacio.causa}</span>
    </p>
  );
}

function Cabecera({ id, titulo, sub, children }: { id: string; titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="aulas-pf-cabecera">
      <h3 id={id} className="aulas-pf-titulo">{titulo}</h3>
      {sub ? <span className="aulas-pf-sub">{sub}</span> : null}
      {children}
    </header>
  );
}

function BotonDeGrupo({ nombre, valor, activo, onFoco }: {
  nombre: string;
  valor: string;
  activo: boolean;
  onFoco: (valor: string) => void;
}) {
  return (
    <button
      type="button"
      className="aulas-pf-grupo"
      aria-pressed={activo}
      title={activo ? "Quitar el foco" : `Poner el foco en ${nombre}`}
      onClick={() => onFoco(valor)}
    >
      {nombre}
    </button>
  );
}

function Procedencia({ procedencia }: { procedencia: ModeloPorFacultad["procedencia"] }) {
  if (!procedencia) return null;
  return (
    <span
      className="aulas-pf-chip aulas-pf-procedencia"
      data-tono={procedencia.degradada ? "aviso" : "neutro"}
      title={procedencia.detalle || undefined}
    >
      {procedencia.chip}
    </span>
  );
}

function Cuota({ cuota, etiquetaEje, procedencia, avisoDelEje, enFoco, onFoco }: {
  cuota: CuotaDeLaPestana;
  etiquetaEje: string;
  procedencia: ModeloPorFacultad["procedencia"];
  avisoDelEje: string | null;
  enFoco: string;
  onFoco: (valor: string) => void;
}) {
  const id = "aulas-pf-cuota-titulo";
  const aviso = avisoDelEje ? (
    <p className="aulas-pf-nota is-aviso" role="status">
      <Info size={14} aria-hidden="true" />
      <span>{avisoDelEje}</span>
    </p>
  ) : null;
  if (cuota.tipo === "vacio") {
    return (
      <section className="aulas-pf-panel aulas-pf-cuota" aria-labelledby={id}>
        <Cabecera id={id} titulo={cuota.titulo}><Procedencia procedencia={procedencia} /></Cabecera>
        {aviso}
        <Nota vacio={cuota.vacio} />
      </section>
    );
  }
  if (cuota.tipo === "sexo") {
    return (
      <section className="aulas-pf-panel aulas-pf-cuota" aria-labelledby={id}>
        <Cabecera id={id} titulo={cuota.titulo} sub={cuota.sub}><Procedencia procedencia={procedencia} /></Cabecera>
        {aviso}
        <div className="aulas-pf-tabla-marco" data-qa-geometry-capacity="owned">
          <table className="aulas-pf-tabla is-sexo" aria-labelledby={id}>
            <colgroup>
              <col className="is-grupo" />
              <col className="is-sexo" />
              <col className="is-cifra" />
              <col className="is-cifra" />
              <col className="is-barra" />
              <col className="is-cifra" />
              <col className="is-lectura" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{etiquetaEje}</th>
                <th scope="col">{cuota.segunda}</th>
                <th scope="col" className="is-num">Logradas</th>
                <th scope="col" className="is-num">Cuota</th>
                <th scope="col"><span className="aulas-pf-oculto">Avance a la cuota</span></th>
                <th scope="col" className="is-num" title="Proyección del motor con todo el plan en juego">Al cierre</th>
                <th scope="col">Lectura</th>
              </tr>
            </thead>
            {cuota.grupos.map((g) => {
              const activo = enFoco !== "" && enFoco === claveDeGrupo(g.valor);
              return (
                <tbody key={g.clave} className={activo ? "is-foco" : undefined}>
                  {g.filas.map((f, i) => (
                    <tr key={f.clave}>
                      {i === 0 ? (
                        <th scope="rowgroup" rowSpan={g.filas.length} className="aulas-pf-celda-grupo">
                          <BotonDeGrupo nombre={g.nombre} valor={g.valor} activo={activo} onFoco={onFoco} />
                        </th>
                      ) : null}
                      <td>{f.sexo}</td>
                      <td className="is-num">{fmt(f.logradas)}</td>
                      <td className="is-num">{f.cuota == null ? "—" : fmt(f.cuota)}</td>
                      <td aria-hidden="true" title={f.aria}>
                        <span className="aulas-pf-barra" data-tono={f.cumple ? "ok" : "aviso"}>
                          <i style={{ width: `${f.relleno}%` }} />
                        </span>
                      </td>
                      <td className="is-num">{f.alCierre}</td>
                      <td className="aulas-pf-lectura" data-tono={f.tono}>{f.lectura}</td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      </section>
    );
  }
  return (
    <section className="aulas-pf-panel aulas-pf-cuota" aria-labelledby={id}>
      <Cabecera id={id} titulo={cuota.titulo} sub={cuota.sub}><Procedencia procedencia={procedencia} /></Cabecera>
      {aviso}
      <div className="aulas-pf-tabla-marco" data-qa-geometry-capacity="owned">
        <table className="aulas-pf-tabla is-eje" aria-labelledby={id}>
          <colgroup>
            <col className="is-grupo" />
            <col className="is-cifra" />
            <col className="is-cifra" />
            <col className="is-barra" />
            <col className="is-cifra" />
            <col className="is-estado" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{etiquetaEje}</th>
              <th scope="col" className="is-num">Efectivas</th>
              <th scope="col" className="is-num">Cuota</th>
              <th scope="col"><span className="aulas-pf-oculto">Avance a la cuota</span></th>
              <th scope="col" className="is-num">Avance</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cuota.filas.map((f) => {
              const activo = enFoco !== "" && enFoco === claveDeGrupo(f.valor);
              return (
                <tr key={f.clave} className={[f.fuera ? "is-fuera" : "", activo ? "is-foco" : ""].join(" ").trim() || undefined}>
                  <th scope="row" className="aulas-pf-celda-grupo">
                    <BotonDeGrupo nombre={f.nombre} valor={f.valor} activo={activo} onFoco={onFoco} />
                  </th>
                  <td className="is-num">{fmt(f.efectivas)}</td>
                  <td className="is-num">{f.cuotaTexto}</td>
                  <td aria-hidden="true" title={f.aria}>
                    {f.fuera ? null : (
                      <span className="aulas-pf-barra is-gruesa" data-tono={f.estado.tono}>
                        <i style={{ width: `${f.relleno}%` }} />
                      </span>
                    )}
                  </td>
                  <td className="is-num"><b>{f.avanceTexto}</b></td>
                  <td><EstadoChip label={f.estado.texto} tone={tonoDeEstadoChip(f.estado.tono)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LateralDeLaPestana({ lateral, etiquetaEje, enFoco }: { lateral: Lateral; etiquetaEje: string; enFoco: string }) {
  if (lateral.tipo === "alcance") {
    const id = "aulas-pf-alcance-titulo";
    return (
      <section className="aulas-pf-panel aulas-pf-alcance" aria-labelledby={id}>
        <Cabecera id={id} titulo="A quién se está alcanzando" sub={lateral.vacio ? undefined : lateral.sub}>
          {lateral.vacio ? null : (
            <span className="aulas-pf-leyenda" aria-hidden="true">
              <span className="is-padron">Padrón</span>
              <span className="is-efectivas">Efectivas</span>
            </span>
          )}
        </Cabecera>
        {lateral.vacio ? <Nota vacio={lateral.vacio} /> : (
          <div
            className="aulas-pf-dimensiones"
            data-qa-geometry-capacity="owned"
            data-qa-geometry-group="aulas-porfacultad-alcance"
            data-qa-geometry-contract="intrinsic"
          >
            {/* Una tabla por dimensión (sexo, carrera…): cada una mide sus filas. */}
            {lateral.dimensiones.map((d) => (
              <table key={d.clave} className="aulas-pf-tabla is-alcance" data-qa-geometry-member={d.clave}>
                <caption>{d.etiqueta}</caption>
                <colgroup>
                  <col className="is-grupo" />
                  <col className="is-barra" />
                  <col className="is-pct" />
                  <col className="is-pct" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col"><span className="aulas-pf-oculto">{d.etiqueta}</span></th>
                    <th scope="col"><span className="aulas-pf-oculto">Comparación</span></th>
                    <th scope="col" className="is-num">Padrón</th>
                    <th scope="col" className="is-num">Efectivas</th>
                  </tr>
                </thead>
                <tbody>
                  {d.filas.map((f) => (
                    <tr key={f.clave}>
                      <th scope="row">{f.etiqueta}</th>
                      <td aria-hidden="true">
                        <span className="aulas-pf-pareja">
                          <span className="aulas-pf-barra is-fina is-padron"><i style={{ width: `${f.anchoPadron}%` }} /></span>
                          <span className="aulas-pf-barra is-fina is-efectivas"><i style={{ width: `${f.anchoEfectivas}%` }} /></span>
                        </span>
                      </td>
                      <td className="is-num aulas-pf-tenue">{f.padron == null ? "—" : pctPerfil(f.padron)}</td>
                      <td className="is-num"><b>{f.efectivas == null ? "—" : pctPerfil(f.efectivas)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        )}
      </section>
    );
  }

  const { franja, rendimiento, consumo } = lateral;
  return (
    <>
      <section className="aulas-pf-panel aulas-pf-franja" aria-labelledby="aulas-pf-franja-titulo">
        {/* Dos bases distintas para la misma palabra: aquí lo que el libro
            DECLARA; en «Qué rindió», las aulas ya aplicadas según su procedencia.
            Sin la base, «Refuerzos 5» y «Refuerzos 0» se leían como contradicción. */}
        <Cabecera id="aulas-pf-franja-titulo" titulo="Desenlaces de los titulares" sub="lo que declara el libro" />
        <dl className="aulas-pf-cifras" data-qa-geometry-group="aulas-porfacultad-franja" data-qa-geometry-contract="equal">
          {franja.cifras.map((c) => (
            <div key={c.clave} title={c.titulo} data-qa-geometry-member={c.clave}>
              <dt>{c.rotulo}</dt>
              <dd className="aulas-pf-num">{c.valor}</dd>
            </div>
          ))}
        </dl>
        {franja.vacio ? <Nota vacio={franja.vacio} /> : null}
      </section>
      <section className="aulas-pf-panel aulas-pf-rinde" aria-labelledby="aulas-pf-rinde-titulo">
        <Cabecera id="aulas-pf-rinde-titulo" titulo="Qué rindió cada tipo de curso-horario" sub="aulas ya aplicadas, por su procedencia" />
        {rendimiento.vacio ? <Nota vacio={rendimiento.vacio} /> : (
          <table className="aulas-pf-tabla is-rinde" aria-labelledby="aulas-pf-rinde-titulo" data-qa-geometry-capacity="owned">
            <colgroup>
              <col className="is-grupo" />
              <col className="is-cifra-corta" />
              <col className="is-cifra" />
              <col className="is-cifra" />
              <col className="is-cifra" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col" className="is-num">Aulas</th>
                <th scope="col" className="is-num">Elegibles</th>
                <th scope="col" className="is-num">Efectivas</th>
                <th scope="col" className="is-num">Tasa</th>
              </tr>
            </thead>
            <tbody>
              {rendimiento.filas.map((f) => (
                <tr key={f.clave} className={f.sinAulas ? "is-sin-aulas" : undefined}>
                  <th scope="row">{f.tipo}</th>
                  <td className="is-num">{f.aulas}</td>
                  <td className="is-num">{f.elegibles}</td>
                  <td className="is-num">{f.efectivas}</td>
                  <td className="is-num"><b>{f.tasa}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rendimiento.nota ? <p className="aulas-pf-pie">{rendimiento.nota}</p> : null}
      </section>
      <section className="aulas-pf-panel aulas-pf-consumo" aria-labelledby="aulas-pf-consumo-titulo">
        <Cabecera id="aulas-pf-consumo-titulo" titulo="Consumo de la reserva" sub={consumo.sub}>
          {consumo.vacio ? null : (
            <span className="aulas-pf-leyenda" aria-hidden="true">
              <span className="is-usadas">Usadas</span>
              <span className="is-libres">Libres</span>
            </span>
          )}
        </Cabecera>
        {consumo.vacio ? <Nota vacio={consumo.vacio} /> : (
          <table className="aulas-pf-tabla is-consumo" aria-labelledby="aulas-pf-consumo-titulo" data-qa-geometry-capacity="owned">
            <colgroup>
              <col className="is-grupo" />
              <col className="is-barra" />
              <col className="is-cifra-ancha" />
            </colgroup>
            <thead className="aulas-pf-oculto">
              <tr>
                <th scope="col">{etiquetaEje}</th>
                <th scope="col">Usadas y libres</th>
                <th scope="col">Usadas de su reserva</th>
              </tr>
            </thead>
            <tbody>
              {consumo.filas.map((f) => (
                <tr key={f.clave} className={enFoco !== "" && enFoco === claveDeGrupo(f.valor) ? "is-foco" : undefined}>
                  <th scope="row">{f.nombre}</th>
                  <td aria-hidden="true" title={f.aria}>
                    <span className="aulas-pf-reserva" style={{ width: `${f.carril}%` }}>
                      <i className="is-usadas" style={{ flexGrow: f.usadas }} />
                      <i className="is-libres" style={{ flexGrow: f.libres }} />
                    </span>
                  </td>
                  <td className="is-num">{fmt(f.usadas)} de {fmt(f.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

export const PorFacultadAulas = memo(PorFacultadAulasImpl);
