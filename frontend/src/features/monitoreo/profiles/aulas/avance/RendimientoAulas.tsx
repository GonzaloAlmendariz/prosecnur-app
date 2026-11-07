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
  TOPE_RAZON,
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
      <div className="aulas-rd-columna is-tiempo" data-qa-geometry-member="tiempo" data-qa-geometry-group="aulas-rd-tiempo" data-qa-geometry-contract="intrinsic">
        <EfectivasPorDia porDia={modelo.porDia} />
        <HoraEnQueSeResponde porHora={modelo.porHora} />
      </div>
      <div className="aulas-rd-columna is-tasa" data-qa-geometry-member="tasa" data-qa-geometry-capacity="owned">
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
    <section className="aulas-rd-panel is-grafico" aria-labelledby={id} data-qa-geometry-member="dias">
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
          <div className="aulas-rd-barras-zona" data-qa-geometry-group="aulas-rd-dias" data-qa-geometry-contract="equal">
            {porDia.barras.map((b) => (
              <div key={b.fecha} className="aulas-rd-barra" title={b.titulo} data-qa-geometry-member={b.fecha}>
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
    <section className="aulas-rd-panel is-grafico" aria-labelledby={id} data-qa-geometry-member="horas">
      <Cabecera id={id} titulo="Rendimiento por hora de aplicación" sub={porHora.tipo === "barras" ? porHora.sub : undefined} />
      {porHora.tipo === "vacio" ? <Nota vacio={porHora.vacio} /> : (
        <>
          <div className="aulas-rd-barras" role="img" aria-label={`Rendimiento por hora: ${porHora.barras.filter((b) => b.aulas).map((b) => b.titulo).join(", ")}`}>
            <div
              className="aulas-rd-barras-zona is-hora is-razon"
              style={{ ["--aulas-rd-cien" as string]: String(1 / TOPE_RAZON) }}
              data-qa-geometry-group="aulas-rd-horas"
              data-qa-geometry-contract="equal"
            >
              {porHora.barras.map((b) => (
                <div key={b.clave} className="aulas-rd-barra" title={b.titulo} data-qa-geometry-member={b.clave}>
                  {/* Sin «%» sobre la barra: con dieciséis horas se pisaban
                      entre vecinas. El subtítulo dice que es % de lo previsto. */}
                  <span className="aulas-rd-num">{b.aulas ? b.razon.replace(" %", "") : ""}</span>
                  <i className={b.pocos ? "is-hora is-pocos" : "is-hora"} style={{ height: `${b.relleno}%` }} />
                </div>
              ))}
            </div>
            <div className="aulas-rd-eje" aria-hidden="true">
              {porHora.barras.map((b) => <span key={b.clave}>{b.etiqueta.replace(":00", "")}</span>)}
            </div>
          </div>
          <p className="aulas-rd-pie">La línea es 100 %, lo previsto. En gris claro, horas con menos de 3 cursos-horario: no se comparan.{porHora.pie ? ` ${porHora.pie}` : ""}</p>
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
          <div className="aulas-rd-pesas" role="table" aria-labelledby={id} data-qa-geometry-group="aulas-rd-pesas" data-qa-geometry-contract="equal">
            <div className="aulas-rd-pesa is-cabeza" role="row" data-qa-geometry-member="cabeza" data-qa-geometry-group="aulas-rd-pesa-cabeza" data-qa-geometry-contract="intrinsic">
              <span role="columnheader">{tasas.eje}</span>
              <span role="columnheader">{tasas.escala}</span>
              <span role="columnheader" className="is-num">Diseño</span>
              <span role="columnheader" className="is-num">Campo</span>
              <span role="columnheader" className="is-num">Aulas</span>
            </div>
            {tasas.filas.map((f) => (
              <div key={f.clave} className="aulas-rd-pesa" role="row" data-qa-geometry-member={f.clave} data-qa-geometry-group={`aulas-rd-pesa-${f.clave}`} data-qa-geometry-contract="intrinsic">
                <span role="rowheader" className="aulas-rd-facultad" title={`${f.facultad}: ${f.senal}`}>{f.facultad}</span>
                <span role="cell">
                  <span className="aulas-rd-riel" role="img" aria-label={f.aria}>
                    <i
                      className="is-tramo"
                      style={{ left: `${Math.min(f.xDiseno, f.xCampo)}%`, width: `${Math.abs(f.xDiseno - f.xCampo)}%` }}
                    />
                    {f.banda ? <i className="is-banda" style={{ left: `${f.banda.x0}%`, width: `${Math.max(0, f.banda.x1 - f.banda.x0)}%` }} /> : null}
                    <i className="is-diseno" style={{ left: `${f.xDiseno}%` }} />
                    <i className={f.bajo ? "is-campo is-bajo" : "is-campo"} style={{ left: `${f.xCampo}%` }} />
                  </span>
                </span>
                <span role="cell" className="is-num aulas-rd-tenue">{f.diseno}</span>
                <b role="cell" className="is-num">{f.campo}</b>
                <span role="cell" className="is-num aulas-rd-tenue">{f.aulas}</span>
              </div>
            ))}
          </div>
          <p className="aulas-rd-pie">Ordenadas por la señal del motor; la franja gris es la banda del 95 % (sin banda con menos de dos cursos-horario).{tasas.pie ? ` ${tasas.pie}` : ""}</p>
        </>
      )}
    </section>
  );
}

function DiaDeLaSemana({ semana }: { semana: Semana }) {
  const id = "aulas-rd-semana-titulo";
  return (
    <section className="aulas-rd-panel is-semana" aria-labelledby={id}>
      <Cabecera id={id} titulo="Día de la semana" sub={semana.tipo === "barras" ? semana.sub : undefined} />
      {semana.tipo === "vacio" ? <Nota vacio={semana.vacio} /> : (
        <>
          <ul className="aulas-rd-semana is-razon" style={{ ["--aulas-rd-cien" as string]: String(1 / TOPE_RAZON) }}>
            {semana.filas.map((f) => (
              <li key={f.clave} title={f.titulo} className={f.pocos ? "is-pocos" : undefined}>
                <span>{f.etiqueta}</span>
                <span className="aulas-rd-pista" aria-hidden="true"><i style={{ width: `${f.relleno}%` }} /></span>
                <b className="aulas-rd-num">{f.razon}</b>
                <span className="aulas-rd-tenue aulas-rd-num">{f.aulas} aulas</span>
              </li>
            ))}
          </ul>
          {semana.pie ? <p className="aulas-rd-pie">{semana.pie}</p> : null}
        </>
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
                  <th scope="col" className="is-num" title="Efectivas contra lo esperado de sus aulas">Esperado</th>
                  <th scope="col" className="is-num" title="Efectivas sobre los asistentes: lo que depende del trabajo en el aula">De asist.</th>
                </tr>
              </thead>
              <tbody>
                {aplicadores.filas.map((f) => (
                  <tr key={f.clave} className={f.pocos ? "is-pocos" : undefined} title={f.titulo}>
                    {/* Apellidos y la inicial del nombre: el nombre completo no cabía en la
                        columna y se recortaba; va entero en el title. */}
                    <th scope="row" title={f.aplicador}>{nombreCorto(f.aplicador)}</th>
                    <td className="is-num">{f.aulas}</td>
                    <td className="is-num">{f.contraEsperado}</td>
                    <td className="is-num">{f.deAsistentes}</td>
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

/** «Chamorro Rodriguez, Rosa Alejandrina» → «Chamorro R., Rosa». */
function nombreCorto(nombre: string): string {
  const [apellidos, nombres] = nombre.split(",").map((t) => t.trim());
  if (!nombres) return nombre;
  const [paterno, materno] = apellidos.split(/\s+/);
  return `${paterno}${materno ? ` ${materno[0]}.` : ""}, ${nombres.split(/\s+/)[0]}`;
}

export const RendimientoAulas = memo(RendimientoAulasImpl);
