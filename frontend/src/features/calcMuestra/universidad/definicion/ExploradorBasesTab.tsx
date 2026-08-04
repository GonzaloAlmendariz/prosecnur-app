/**
 * Pestaña «Explorador» (sección Marco): las bases por dentro, variable a
 * variable.
 *
 * G42 · Gonzalo: «falta la pestaña que nos permite explorar las bases de
 * estudiantes y cursos-horario con gráficos muy similares a los del explorador
 * de base de procesamiento/validación».
 *
 * Toma el mismo reparto que aquel —lista de variables a la izquierda, la
 * elegida desplegada a la derecha— pero no lo reusa: el de Procesamiento vive
 * sobre la base cargada del pipeline (su store, sus endpoints, Plotly) y aquí
 * las bases son las que el motor de muestra ya publicó en el frame. Traer aquel
 * componente habría significado arrastrar su store y su runtime de gráficos a
 * una pestaña que sólo describe dos tablas que ya están en memoria.
 *
 * Lo que se ve es la base LEÍDA, no el marco: sin criterios aplicados y sin
 * embudo. La pestaña lo dice, porque la misma columna aquí y en la radiografía
 * responde a preguntas distintas.
 */
import { useMemo, useState } from "react";
import { Compass, Search } from "../../../../vendor/lucide-react";
import type { CalcMuestraAulasState } from "../../../../api/client";
import type { MonitoreoRow } from "../../../../api/client";
import { EmptyState } from "../../../../components/States";
import { fmtDec, fmtInt, fmtPct, rowsFrom } from "../../sharedCore";
import {
  distribucionDe,
  inventarioVariables,
  type VariableExplorador,
} from "./exploradorBasesModel";
import "./exploradorBases.css";

type BaseExplorable = "aulas" | "estudiantes";

function Histograma({ bins }: { bins: Array<{ desde: number; hasta: number; n: number }> }) {
  const alto = Math.max(...bins.map((bin) => bin.n), 1);
  return (
    <div className="cmv2-expb-hist" role="img" aria-label={`Histograma de ${bins.length} tramos`}>
      {bins.map((bin, index) => (
        <i
          key={index}
          style={{ height: `${Math.max(2, (bin.n / alto) * 100)}%` }}
          title={`${fmtDec(bin.desde, 1)} – ${fmtDec(bin.hasta, 1)}: ${fmtInt(bin.n)}`}
        />
      ))}
    </div>
  );
}

export function ExploradorBasesTab({ aulasState }: { aulasState: CalcMuestraAulasState | null }) {
  const [base, setBase] = useState<BaseExplorable>("aulas");
  const [busqueda, setBusqueda] = useState("");
  const [variable, setVariable] = useState<string>("");

  const filas = useMemo<MonitoreoRow[]>(() => {
    const frame = aulasState?.frame;
    return rowsFrom<MonitoreoRow>(
      base === "aulas" ? frame?.aula_frame : frame?.population,
    );
  }, [aulasState?.frame, base]);

  const variables = useMemo(() => inventarioVariables(filas), [filas]);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? variables.filter((row) => row.columna.toLowerCase().includes(q)) : variables;
  }, [variables, busqueda]);
  const activa: VariableExplorador | null =
    visibles.find((row) => row.columna === variable) ?? visibles[0] ?? null;
  const distribucion = useMemo(
    () => (activa ? distribucionDe(filas, activa.columna, activa.tipo) : null),
    [filas, activa],
  );

  const marcoConstruido = Boolean(aulasState?.frame);
  const disponibles = {
    aulas: rowsFrom(aulasState?.frame?.aula_frame).length,
    estudiantes: rowsFrom(aulasState?.frame?.population).length,
  };

  return (
    <section
      className="cmv2-expb"
      data-audit-ready={filas.length ? "true" : "false"}
      aria-label="Explorador de bases"
    >
      <header className="cmv2-expb-head">
        <div className="cmv2-expb-title">
          <Compass size={18} aria-hidden="true" />
          <div>
            <strong>Explorador de bases</strong>
            {/* La distinción no es un matiz: la misma columna aquí y en la
                radiografía responde a preguntas distintas. */}
            <p>
              Describe las bases <strong>tal como se leyeron</strong>: sin criterios aplicados y
              sin embudo. Para ver qué recorta cada criterio, Cursos-horario: criterios +
              radiografía.
            </p>
          </div>
        </div>
        <div className="cmv2-expb-bases" role="group" aria-label="Base a explorar">
          <button
            type="button"
            data-activo={base === "aulas" || undefined}
            onClick={() => { setBase("aulas"); setVariable(""); }}
          >
            Cursos-horario<em>{fmtInt(disponibles.aulas)} filas</em>
          </button>
          <button
            type="button"
            data-activo={base === "estudiantes" || undefined}
            onClick={() => { setBase("estudiantes"); setVariable(""); }}
          >
            Estudiantes<em>{fmtInt(disponibles.estudiantes)} filas</em>
          </button>
        </div>
      </header>

      {!filas.length ? (
        /*
         * G42 · El vacío de Estudiantes casi nunca significa «no hay datos».
         *
         * El backend PODA `frame$population` al guardar el `.pulso`
         * (project_pulso.R): son decenas de miles de filas que se pueden
         * reconstruir, así que no viajan. Al abrir un proyecto guardado la
         * población siempre sale en cero, y decir «el marco todavía no publica»
         * mandaría a buscar un problema que no existe.
         */
        <EmptyState
          icon={<Compass size={22} aria-hidden="true" />}
          title={base === "aulas"
            ? "El marco todavía no publica la base de cursos-horario"
            : marcoConstruido
              ? "La población no viaja en el proyecto guardado"
              : "El marco todavía no publica la población de estudiantes"}
          hint={base === "estudiantes" && marcoConstruido
            ? "Son decenas de miles de filas que se reconstruyen: recalcula el marco en esta sesión y vuelve aquí. Los cursos-horario sí viajan y puedes explorarlos ahora."
            : "Construye el marco desde tus fuentes (sección Marco) y vuelve aquí."}
        />
      ) : (
        <div className="cmv2-expb-cuerpo">
          <aside className="cmv2-expb-lista" aria-label="Variables de la base">
            <label className="cmv2-expb-buscador">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={busqueda}
                placeholder={`Buscar entre ${fmtInt(variables.length)} variables`}
                onChange={(event) => setBusqueda(event.target.value)}
              />
            </label>
            <ul>
              {visibles.map((row) => (
                <li key={row.columna}>
                  <button
                    type="button"
                    data-activa={activa?.columna === row.columna || undefined}
                    onClick={() => setVariable(row.columna)}
                  >
                    <span className="cmv2-expb-var">{row.columna}</span>
                    <span className="cmv2-expb-meta">
                      {row.tipo === "numerica" ? "numérica" : `${fmtInt(row.distintos)} valores`}
                    </span>
                  </button>
                </li>
              ))}
              {!visibles.length ? <li className="cmv2-expb-vacio">Ninguna variable coincide.</li> : null}
            </ul>
          </aside>

          <div className="cmv2-expb-detalle">
            {!activa || !distribucion ? (
              <EmptyState
                icon={<Search size={20} aria-hidden="true" />}
                title="Esa variable no trae datos utilizables"
                hint="Elige otra en la lista de la izquierda."
              />
            ) : (
              <article className="cmv2-expb-card">
                <header>
                  <strong>{activa.columna}</strong>
                  <span>
                    {fmtInt(distribucion.conDato)} con dato
                    {distribucion.sinDato > 0 ? ` · ${fmtInt(distribucion.sinDato)} sin dato` : ""}
                  </span>
                </header>

                {distribucion.tipo === "numerica" ? (
                  <>
                    <dl className="cmv2-expb-cifras">
                      <div><dt>Mínimo</dt><dd>{fmtDec(distribucion.min, 1)}</dd></div>
                      <div><dt>P25</dt><dd>{fmtDec(distribucion.p25, 1)}</dd></div>
                      <div><dt>Mediana</dt><dd>{fmtDec(distribucion.p50, 1)}</dd></div>
                      <div><dt>Media</dt><dd>{fmtDec(distribucion.media, 1)}</dd></div>
                      <div><dt>P75</dt><dd>{fmtDec(distribucion.p75, 1)}</dd></div>
                      <div><dt>Máximo</dt><dd>{fmtDec(distribucion.max, 1)}</dd></div>
                    </dl>
                    <Histograma bins={distribucion.bins} />
                  </>
                ) : (
                  <>
                    <ul className="cmv2-expb-categorias">
                      {distribucion.categorias.map((categoria) => (
                        <li key={categoria.clave}>
                          <span className="cmv2-expb-cat-label" title={categoria.clave}>
                            {categoria.clave}
                          </span>
                          <span className="cmv2-expb-cat-bar" aria-hidden="true">
                            <i style={{ width: `${Math.max(1, categoria.share * 100)}%` }} />
                          </span>
                          <span className="cmv2-expb-cat-n">
                            {fmtInt(categoria.n)}<em>{fmtPct(categoria.share)}</em>
                          </span>
                        </li>
                      ))}
                    </ul>
                    {distribucion.otras ? (
                      <p className="cmv2-expb-otras" role="note">
                        Otras {fmtInt(distribucion.otras.categorias)} categorías reúnen{" "}
                        {fmtInt(distribucion.otras.n)} filas.
                      </p>
                    ) : null}
                  </>
                )}
              </article>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
