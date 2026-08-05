/**
 * Pestaña «Explorador» (sección Datos): las bases por dentro, variable a
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
 *
 * G43 · Segunda pasada visual. La primera versión funcionaba y se leía como un
 * formulario: título repetido —la pestaña ya lo declara—, un párrafo de tres
 * líneas compitiendo con el dato, doce variables visibles de veintiséis en
 * fichas de dos líneas, y medio viewport vacío bajo la tarjeta. Ahora la
 * superficie se organiza como lo que es, un índice y una lectura:
 *
 * - una sola barra de contexto con el conmutador de base y el recuento;
 * - índice denso, agrupado por tipo, con la cobertura de cada variable a la
 *   vista, a una línea por fila;
 * - lectura a la derecha con su cabecera de cifras y el gráfico al ancho.
 *
 * Cada carril posee su scroll (C4) y el vacío vive dentro de la superficie
 * (C3): la página no crece ni se queda con un hueco al pie.
 */
import { useMemo, useState } from "react";
import { Compass, Search } from "../../../../vendor/lucide-react";
import {
  normalizeCriteriosCatalogo,
  type CalcMuestraAulasState,
  type CalcMuestraWorkspace,
  type MonitoreoRow,
} from "../../../../api/client";
import { EmptyState } from "../../../../components/States";
import { fmtDec, fmtInt, fmtPct, rowsFrom } from "../../sharedCore";
import {
  distribucionDe,
  inventarioVariables,
  type DistribucionNumerica,
  type VariableExplorador,
} from "./exploradorBasesModel";
import { nombreDeColumna, type NombreColumna } from "./exploradorBasesNombres";
import "./exploradorBases.css";

type BaseExplorable = "aulas" | "estudiantes";

/**
 * G43 · El histograma dice dónde está la masa; el eje dice dónde cae.
 *
 * Sin las marcas del eje las barras son una silueta: se ve que hay una joroba y
 * no dónde está. La mediana se marca sobre las barras porque es la referencia
 * que se busca al mirar una distribución de tamaños.
 */
function Histograma({ dist }: { dist: DistribucionNumerica }) {
  const alto = Math.max(...dist.bins.map((bin) => bin.n), 1);
  const rango = dist.max - dist.min;
  const posMediana = rango > 0 ? ((dist.p50 - dist.min) / rango) * 100 : 50;
  return (
    <figure
      className="cmv2-expb-figura"
      role="img"
      aria-label={`Distribución de ${dist.conDato} valores entre ${fmtDec(dist.min, 1)} y ${fmtDec(dist.max, 1)}, mediana ${fmtDec(dist.p50, 1)}`}
    >
      <div className="cmv2-expb-hist">
        <i className="cmv2-expb-hist-mediana" style={{ left: `${posMediana}%` }} aria-hidden="true" />
        {dist.bins.map((bin, index) => (
          <span
            key={index}
            style={{ height: `${Math.max(1.5, (bin.n / alto) * 100)}%` }}
            title={`${fmtDec(bin.desde, 1)} – ${fmtDec(bin.hasta, 1)}: ${fmtInt(bin.n)}`}
          />
        ))}
      </div>
      <figcaption className="cmv2-expb-eje" aria-hidden="true">
        <span>{fmtDec(dist.min, 1)}</span>
        <span data-marca="mediana">mediana {fmtDec(dist.p50, 1)}</span>
        <span>{fmtDec(dist.max, 1)}</span>
      </figcaption>
    </figure>
  );
}

export function ExploradorBasesTab({
  aulasState,
  workspace,
}: {
  aulasState: CalcMuestraAulasState | null;
  /** G43 · Trae el mapeo rol → columna para llamar a cada variable como se llama
   *  en el archivo del usuario, no como la nombra el motor. */
  workspace?: CalcMuestraWorkspace | null;
}) {
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
  /**
   * La columna que el motor leyó, publicada por el catálogo de criterios.
   *
   * Es la fuente fiable del nombre del archivo: el `config.mapping` del frame
   * mezcla los alias candidatos de cada rol y sus pares salen cruzados.
   */
  const mappingMotor = useMemo(() => {
    const catalogo = normalizeCriteriosCatalogo(aulasState?.frame?.criterios_catalogo ?? null);
    const mapa: Record<string, string> = {};
    for (const variable of catalogo.variables) {
      if (variable.mappedColumn && variable.mappedColumn.trim()) {
        mapa[variable.id] = variable.mappedColumn.trim();
      }
    }
    return mapa;
  }, [aulasState?.frame?.criterios_catalogo]);
  const nombres = useMemo(() => {
    const mapa = new Map<string, NombreColumna>();
    for (const row of variables) {
      mapa.set(
        row.columna,
        nombreDeColumna(row.columna, workspace?.variable_mappings, mappingMotor),
      );
    }
    return mapa;
  }, [variables, workspace?.variable_mappings, mappingMotor]);
  const nombreDe = (columna: string): NombreColumna =>
    nombres.get(columna) ?? { titulo: columna, tecnico: columna, origen: "interno" };
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    // Ordenado por el nombre que se ve, no por el técnico: buscar «Condición»
    // en una lista alfabetizada por `condicion_curso` es buscar a ciegas.
    const orden = [...variables].sort((a, b) => {
      const ta = nombres.get(a.columna)?.titulo ?? a.columna;
      const tb = nombres.get(b.columna)?.titulo ?? b.columna;
      return ta.localeCompare(tb, "es");
    });
    if (!q) return orden;
    // Se busca por los dos nombres: quien subió la base escribe el del archivo y
    // quien conoce el motor escribe el técnico.
    return orden.filter((row) => {
      const nombre = nombres.get(row.columna);
      return row.columna.toLowerCase().includes(q) ||
        (nombre?.titulo ?? "").toLowerCase().includes(q);
    });
  }, [variables, busqueda, nombres]);
  /*
   * G43 · El índice se agrupa por ORIGEN, no por tipo.
   *
   * Gonzalo: «muchas variables en el explorador ni siquiera están en la base».
   * Tenía razón y era el defecto de fondo: lo que se explora es el `aula_frame`,
   * que es el marco DERIVADO —34 columnas—, y ahí conviven las del archivo con
   * las que calcula el motor (`included`, `exclude_reason`, `size_group`,
   * `prevalence_ratio`…). Mezcladas en una sola lista, las derivadas se leían
   * como columnas del Excel que nadie recordaba haber subido.
   *
   * Agrupar por categórica/numérica —lo que hacía la versión anterior— separa
   * dos lecturas, sí, pero el tipo ya se ve en cada fila y no responde a la
   * pregunta que el usuario se hace al abrir la pestaña: ¿esto lo subí yo?
   */
  const grupos = useMemo(() => ([
    {
      clave: "excel" as const,
      titulo: "De tu archivo",
      nota: null as string | null,
      filas: visibles.filter((row) => nombres.get(row.columna)?.origen === "excel"),
    },
    {
      clave: "motor" as const,
      titulo: "Que calcula el marco",
      nota: null,
      filas: visibles.filter((row) => nombres.get(row.columna)?.origen === "motor"),
    },
    {
      clave: "interno" as const,
      titulo: "Otras columnas del marco",
      nota: null,
      filas: visibles.filter((row) => nombres.get(row.columna)?.origen === "interno"),
    },
  ].filter((grupo) => grupo.filas.length)), [visibles, nombres]);
  const delArchivo = useMemo(
    () => variables.filter((row) => nombres.get(row.columna)?.origen === "excel").length,
    [variables, nombres],
  );

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
  const cobertura = activa && filas.length ? activa.conDato / filas.length : null;

  return (
    <section
      className="cmv2-expb"
      data-audit-ready={filas.length ? "true" : "false"}
      data-qa-geometry-group="calc-muestra/explorador-bases"
      data-qa-geometry-contract="intrinsic"
      aria-label="Explorador de bases"
    >
      {/* Una sola barra de contexto: qué base se mira, cuánto trae y de qué
          habla. El título de la pestaña ya lo declara el chrome (C1), así que
          repetirlo aquí sólo gastaba la primera línea de la superficie. */}
      <header className="cmv2-expb-barra">
        <div className="cmv2-expb-conmutador" role="group" aria-label="Base a explorar">
          {([
            { id: "aulas" as const, label: "Cursos-horario", n: disponibles.aulas },
            { id: "estudiantes" as const, label: "Estudiantes", n: disponibles.estudiantes },
          ]).map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              aria-pressed={base === opcion.id}
              data-activo={base === opcion.id || undefined}
              onClick={() => { setBase(opcion.id); setVariable(""); }}
            >
              {opcion.label}
              <em>{fmtInt(opcion.n)}</em>
            </button>
          ))}
        </div>
        <p className="cmv2-expb-nota" role="note">
          {filas.length ? (
            <>
              <strong>{fmtInt(variables.length)} columnas</strong> del marco vigente
              {delArchivo ? <> · {fmtInt(delArchivo)} vienen de tu archivo</> : null}. Sin criterios
              ni embudo: lo que recorta cada criterio vive en Marco › Cursos-horario.
            </>
          ) : (
            <>Las bases <strong>tal como se leyeron</strong>, sin criterios ni embudo.</>
          )}
        </p>
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
        <div className="cmv2-expb-vacio-marco">
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
        </div>
      ) : (
        <div className="cmv2-expb-cuerpo">
          <aside className="cmv2-expb-indice" aria-label="Variables de la base">
            <label className="cmv2-expb-buscador">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={busqueda}
                placeholder={`Buscar entre ${fmtInt(variables.length)} variables`}
                onChange={(event) => setBusqueda(event.target.value)}
              />
            </label>
            <div className="cmv2-expb-scroll">
              {grupos.map((grupo) => (
                <section key={grupo.clave} className="cmv2-expb-grupo">
                  <h3>
                    {grupo.titulo}
                    <span>{fmtInt(grupo.filas.length)}</span>
                  </h3>
                  <ul>
                    {grupo.filas.map((row) => {
                      const share = filas.length ? row.conDato / filas.length : 0;
                      return (
                        <li key={row.columna}>
                          <button
                            type="button"
                            data-activa={activa?.columna === row.columna || undefined}
                            onClick={() => setVariable(row.columna)}
                            title={`${nombreDe(row.columna).titulo} · columna ${row.columna} · ${fmtPct(share)} con dato`}
                          >
                            <span className="cmv2-expb-var">{nombreDe(row.columna).titulo}</span>
                            {/* G43 · La cobertura sólo se nombra cuando falta
                                dato, y como cifra: la barra bajo cada fila —dos
                                versiones probadas en pantalla— se leía como un
                                subrayado, y al dibujarse en todas las filas
                                dejaba de señalar la que importa. */}
                            {share < 0.995 ? (
                              <span className="cmv2-expb-parcial" title="Filas con dato">
                                {fmtPct(share)}
                              </span>
                            ) : null}
                            <span className="cmv2-expb-meta">
                              {row.tipo === "numerica" ? "núm." : fmtInt(row.distintos)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {!visibles.length ? (
                <p className="cmv2-expb-sin-match">Ninguna variable coincide con «{busqueda}».</p>
              ) : (
                /* El marco no arrastra el archivo entero, y callarlo hacía
                   buscar aquí columnas que nunca van a estar. */
                <p className="cmv2-expb-pie" role="note">
                  El marco no arrastra todas las columnas del archivo: los datos de contacto y los
                  que no participan del muestreo se quedan fuera.
                </p>
              )}
            </div>
          </aside>

          <div className="cmv2-expb-lectura">
            {!activa || !distribucion ? (
              <EmptyState
                icon={<Search size={20} aria-hidden="true" />}
                title="Esa variable no trae datos utilizables"
                hint="Elige otra en el índice de la izquierda."
              />
            ) : (
              <article className="cmv2-expb-card">
                <header className="cmv2-expb-card-head">
                  <div className="cmv2-expb-card-title">
                    <h3>{nombreDe(activa.columna).titulo}</h3>
                    <p>
                      {distribucion.tipo === "numerica"
                        ? "Numérica"
                        : `Categórica · ${fmtInt(activa.distintos)} valores distintos`}
                      {" · "}
                      {/* De dónde sale la columna. Sin esto, «Alumnos elegibles»
                          parece venir del archivo y no del marco. */}
                      {nombreDe(activa.columna).origen === "excel" ? (
                        <>columna del archivo · <code>{activa.columna}</code> en el motor</>
                      ) : nombreDe(activa.columna).origen === "motor" ? (
                        <>la calcula el marco: {nombreDe(activa.columna).detalle}</>
                      ) : (
                        <>columna del marco · <code>{activa.columna}</code></>
                      )}
                    </p>
                  </div>
                  <dl className="cmv2-expb-chips">
                    <div>
                      <dt>Con dato</dt>
                      <dd>{fmtInt(distribucion.conDato)}</dd>
                    </div>
                    <div data-alerta={distribucion.sinDato > 0 || undefined}>
                      <dt>Sin dato</dt>
                      <dd>
                        {fmtInt(distribucion.sinDato)}
                        {cobertura != null && distribucion.sinDato > 0 ? (
                          <em>{fmtPct(1 - cobertura)}</em>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                </header>

                {distribucion.tipo === "numerica" ? (
                  <div className="cmv2-expb-numerica">
                    <Histograma dist={distribucion} />
                    <dl
                      className="cmv2-expb-cuantiles"
                      data-qa-geometry-group="calc-muestra/explorador-cuantiles"
                      data-qa-geometry-contract="equal"
                    >
                      {([
                        ["Mínimo", distribucion.min],
                        ["P25", distribucion.p25],
                        ["Mediana", distribucion.p50],
                        ["Media", distribucion.media],
                        ["P75", distribucion.p75],
                        ["Máximo", distribucion.max],
                      ] as const).map(([label, valor]) => (
                        <div key={label} data-qa-geometry-member data-qa-geometry-capacity="owned">
                          <dt>{label}</dt>
                          <dd>{fmtDec(valor, 1)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : (
                  <ul
                    className="cmv2-expb-categorias"
                    data-qa-geometry-group="calc-muestra/explorador-categorias"
                    data-qa-geometry-contract="equal"
                  >
                    {distribucion.categorias.map((categoria) => (
                      <li key={categoria.clave} data-qa-geometry-member data-qa-geometry-capacity="owned">
                        <span className="cmv2-expb-cat-label" title={categoria.clave}>
                          {categoria.clave}
                        </span>
                        <span className="cmv2-expb-cat-bar" aria-hidden="true">
                          <i style={{ width: `${Math.max(0.8, categoria.share * 100)}%` }} />
                        </span>
                        <span className="cmv2-expb-cat-n">{fmtInt(categoria.n)}</span>
                        <span className="cmv2-expb-cat-pct">{fmtPct(categoria.share)}</span>
                      </li>
                    ))}
                    {/* La cola entra como una fila más, apagada: fuera de la
                        lista se leía como un pie de página y no como parte del
                        mismo reparto, que es lo que suma el total. */}
                    {distribucion.otras ? (
                      <li data-resto="true" data-qa-geometry-member data-qa-geometry-capacity="owned">
                        <span className="cmv2-expb-cat-label">
                          Otras {fmtInt(distribucion.otras.categorias)} categorías
                        </span>
                        <span className="cmv2-expb-cat-bar" aria-hidden="true">
                          <i
                            style={{
                              width: `${Math.max(0.8, (distribucion.otras.n / distribucion.conDato) * 100)}%`,
                            }}
                          />
                        </span>
                        <span className="cmv2-expb-cat-n">{fmtInt(distribucion.otras.n)}</span>
                        <span className="cmv2-expb-cat-pct">
                          {fmtPct(distribucion.otras.n / distribucion.conDato)}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                )}
              </article>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
