import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { fmt } from "../kpisDeAulas";
import type { Vacio } from "./porFacultadModelo";
import {
  construirRendimiento,
  readinessDeRendimiento,
  type Aplicadores,
  type PorDia,
  type PorHora,
  type Semana,
  type Tasas,
} from "./rendimientoModelo";
import "./rendimiento.css";

/**
 * Avance › Rendimiento (ficha A4, `docs/qa/revamp-monitoreo/aulas.md`).
 * ¿Cuándo y con quién rinde el campo?
 *
 * Tres columnas: el tiempo (por día y por hora), la tasa del campo contra la
 * del diseño por facultad, y el esfuerzo (día de la semana y aplicador).
 *
 * Desplazamiento: en escritorio amplio la vista llena el alto y sólo la tabla
 * de aplicadores desplaza dentro de su marco; en compacto (≤ 1180 px de ancho
 * o ≤ 720 px de alto) la vista mide por contenido y desplaza
 * `.mon-profile-content`, el dueño de scroll del perfil (C4).
 */
function RendimientoAulasImpl({ dashboard, cargando, vacioSinTablero }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  /** El vacío del perfil sin tablero (plan sin importar, fuentes, error de lectura). */
  vacioSinTablero: ReactNode;
}) {
  const modelo = useMemo(() => (cargando ? null : construirRendimiento(dashboard)), [cargando, dashboard]);
  const readiness = readinessDeRendimiento(modelo, cargando);

  if (!modelo) return <Silueta readiness={readiness} />;

  if (modelo.estado === "sin-tablero") {
    return (
      <section className="aulas-rd aulas-rd--vacio" aria-label="Rendimiento" data-audit-ready={readiness}>
        {vacioSinTablero}
      </section>
    );
  }

  return (
    <section
      className="aulas-rd"
      aria-label="Rendimiento"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-rendimiento"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="aulas-rd-columna is-tiempo" data-qa-geometry-member="tiempo">
        <EfectivasPorDia porDia={modelo.porDia} />
        <HoraEnQueSeResponde porHora={modelo.porHora} />
      </div>
      <div className="aulas-rd-columna is-tasa" data-qa-geometry-member="tasa">
        <TasaContraDiseno tasas={modelo.tasas} />
      </div>
      <div className="aulas-rd-columna is-esfuerzo" data-qa-geometry-member="esfuerzo">
        <DiaDeLaSemana semana={modelo.semana} />
        <PorAplicador aplicadores={modelo.aplicadores} />
      </div>
    </section>
  );
}

/** S1: la misma silueta mientras se prepara el corte, con el tiempo que lleva. */
function Silueta({ readiness }: { readiness: string }) {
  const segundos = useTranscurrido();
  const reloj = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
  return (
    <section className="aulas-rd aulas-rd--silueta" aria-label="Rendimiento" aria-busy="true" data-audit-ready={readiness}>
      <div className="aulas-rd-columna">
        <div className="aulas-rd-panel aulas-rd-silueta">
          <p className="aulas-rd-preparando" role="status">
            Preparando el corte <span className="aulas-rd-num">{reloj}</span>
          </p>
        </div>
        <div className="aulas-rd-panel aulas-rd-silueta" />
      </div>
      <div className="aulas-rd-columna"><div className="aulas-rd-panel aulas-rd-silueta" /></div>
      <div className="aulas-rd-columna">
        <div className="aulas-rd-panel aulas-rd-silueta" />
        <div className="aulas-rd-panel aulas-rd-silueta" />
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
    <p className="aulas-rd-nota" data-qa-geometry-empty={vacio.clase}>
      <Info size={14} aria-hidden="true" />
      <span>{vacio.causa}</span>
    </p>
  );
}

function Cabecera({ id, titulo, sub, children }: { id: string; titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="aulas-rd-cabecera">
      <h3 id={id} className="aulas-rd-titulo">{titulo}</h3>
      {sub ? <span className="aulas-rd-sub">{sub}</span> : null}
      {children}
    </header>
  );
}

function EfectivasPorDia({ porDia }: { porDia: PorDia }) {
  const id = "aulas-rd-dia-titulo";
  return (
    <section className="aulas-rd-panel is-grafico" aria-labelledby={id}>
      <Cabecera id={id} titulo="Efectivas por día" sub={porDia.tipo === "barras" ? porDia.sub : undefined}>
        {porDia.tipo === "barras" && porDia.barras.some((b) => b.finDeSemana) ? (
          <span className="aulas-rd-leyenda" aria-hidden="true">
            <span className="is-semana">Lunes a viernes</span>
            <span className="is-fin">Fin de semana</span>
          </span>
        ) : null}
      </Cabecera>
      {porDia.tipo === "vacio" ? <Nota vacio={porDia.vacio} /> : (
        <div className="aulas-rd-barras" role="img" aria-label={`Efectivas por día: ${porDia.barras.filter((b) => b.validas).map((b) => b.titulo).join(", ")}`}>
          <div className="aulas-rd-barras-zona">
            {porDia.barras.map((b) => (
              <div key={b.fecha} className="aulas-rd-barra" title={b.titulo}>
                <span className="aulas-rd-num">{b.validas ? fmt(b.validas) : ""}</span>
                <i className={b.finDeSemana ? "is-fin" : undefined} style={{ height: `${b.alto}%` }} />
              </div>
            ))}
          </div>
          <div className="aulas-rd-eje" aria-hidden="true">
            {porDia.barras.map((b) => <span key={b.fecha}>{b.etiqueta}</span>)}
          </div>
        </div>
      )}
    </section>
  );
}

function HoraEnQueSeResponde({ porHora }: { porHora: PorHora }) {
  const id = "aulas-rd-hora-titulo";
  return (
    <section className="aulas-rd-panel is-grafico" aria-labelledby={id}>
      <Cabecera id={id} titulo="Hora en que se responde" sub={porHora.tipo === "barras" ? porHora.sub : undefined} />
      {porHora.tipo === "vacio" ? <Nota vacio={porHora.vacio} /> : (
        <>
          <div className="aulas-rd-barras" role="img" aria-label={`Hora en que se responde: ${porHora.barras.filter((b) => b.validas).map((b) => b.titulo).join(", ")}`}>
            <div className="aulas-rd-barras-zona is-hora">
              {porHora.barras.map((b) => (
                <div key={b.hora} className="aulas-rd-barra" title={b.titulo}>
                  <i className={b.pico ? "is-hora is-pico" : "is-hora"} style={{ height: `${b.alto}%` }} />
                </div>
              ))}
            </div>
            <div className="aulas-rd-eje" aria-hidden="true">
              {porHora.barras.map((b) => <span key={b.hora}>{b.etiqueta}</span>)}
            </div>
          </div>
          {porHora.pie ? <p className="aulas-rd-pie">{porHora.pie}</p> : null}
        </>
      )}
    </section>
  );
}

function TasaContraDiseno({ tasas }: { tasas: Tasas }) {
  const id = "aulas-rd-tasa-titulo";
  return (
    <section className="aulas-rd-panel is-tasa" aria-labelledby={id}>
      <Cabecera id={id} titulo="Tasa del campo contra la del diseño">
        {tasas.tipo === "pesas" ? (
          <span className="aulas-rd-leyenda" aria-hidden="true">
            <span className="is-diseno">Diseño</span>
            <span className="is-campo">Campo</span>
          </span>
        ) : null}
      </Cabecera>
      {tasas.tipo === "vacio" ? <Nota vacio={tasas.vacio} /> : (
        <>
          <div className="aulas-rd-pesas" role="table" aria-labelledby={id}>
            <div className="aulas-rd-pesa is-cabeza" role="row">
              <span role="columnheader">{tasas.eje}</span>
              <span role="columnheader">{tasas.escala}</span>
              <span role="columnheader" className="is-num">Diseño</span>
              <span role="columnheader" className="is-num">Campo</span>
            </div>
            {tasas.filas.map((f) => (
              <div key={f.clave} className="aulas-rd-pesa" role="row">
                <span role="rowheader" className="aulas-rd-facultad" title={f.facultad}>{f.facultad}</span>
                <span role="cell">
                  <span className="aulas-rd-riel" role="img" aria-label={f.aria}>
                    <i
                      className="is-tramo"
                      style={{ left: `${Math.min(f.xDiseno, f.xCampo)}%`, width: `${Math.abs(f.xDiseno - f.xCampo)}%` }}
                    />
                    <i className="is-diseno" style={{ left: `${f.xDiseno}%` }} />
                    <i className={f.bajo ? "is-campo is-bajo" : "is-campo"} style={{ left: `${f.xCampo}%` }} />
                  </span>
                </span>
                <span role="cell" className="is-num aulas-rd-tenue">{f.diseno}</span>
                <b role="cell" className="is-num">{f.campo}</b>
              </div>
            ))}
          </div>
          {tasas.pie ? <p className="aulas-rd-pie">{tasas.pie}</p> : null}
        </>
      )}
    </section>
  );
}

function DiaDeLaSemana({ semana }: { semana: Semana }) {
  const id = "aulas-rd-semana-titulo";
  return (
    <section className="aulas-rd-panel is-semana" aria-labelledby={id}>
      <Cabecera id={id} titulo="Día de la semana" />
      {semana.tipo === "vacio" ? <Nota vacio={semana.vacio} /> : (
        <ul className="aulas-rd-semana">
          {semana.filas.map((f) => (
            <li key={f.clave}>
              <span>{f.dia}</span>
              <span className="aulas-rd-pista" aria-hidden="true"><i style={{ width: `${f.relleno}%` }} /></span>
              <b className="aulas-rd-num">{fmt(f.validas)}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PorAplicador({ aplicadores }: { aplicadores: Aplicadores }) {
  const id = "aulas-rd-aplicador-titulo";
  return (
    <section className="aulas-rd-panel is-aplicador" aria-labelledby={id}>
      <Cabecera id={id} titulo="Por aplicador" sub={aplicadores.tipo === "tabla" ? aplicadores.sub : undefined} />
      {aplicadores.tipo === "vacio" ? <Nota vacio={aplicadores.vacio} /> : (
        <>
          <div
            className="aulas-rd-tabla-marco"
            data-qa-geometry-capacity="owned"
            tabIndex={0}
            aria-label="Rendimiento por aplicador, con desplazamiento"
          >
            <table className="aulas-rd-tabla" aria-labelledby={id}>
              <thead>
                <tr>
                  <th scope="col">Aplicador</th>
                  <th scope="col" className="is-num">Aulas</th>
                  <th scope="col" className="is-num">Efectivas</th>
                  <th scope="col" className="is-num">Tasa</th>
                </tr>
              </thead>
              <tbody>
                {aplicadores.filas.map((f) => (
                  <tr key={f.clave}>
                    <th scope="row" title={f.aplicador}>{f.aplicador}</th>
                    <td className="is-num">{f.aulas}</td>
                    <td className="is-num">{f.efectivas}</td>
                    <td className="is-num" title={f.tituloTasa}>{f.tasa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {aplicadores.pie ? <p className="aulas-rd-pie">{aplicadores.pie}</p> : null}
        </>
      )}
    </section>
  );
}

export const RendimientoAulas = memo(RendimientoAulasImpl);
