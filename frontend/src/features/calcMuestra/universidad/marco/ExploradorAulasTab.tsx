/**
 * Pestaña "Explorador" de Marco: radiografía del marco por facultad (contrato
 * calc_muestra_aulas_exploracion_v1). El académico ve CUÁNTAS aulas hay, DÓNDE
 * están (incl. locales externos) y CUÁLES convienen por facultad, con datos
 * transparentes: columnas ordenables y fórmula literal de elegibles efectivos
 * — nunca un score compuesto de caja negra. Tolerante a ausencia: marcos sin
 * `exploracion` muestran el estado vacío honesto. La lógica calculable vive en
 * exploradorModel.ts; aquí solo se presenta.
 */
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Compass, Layers3, MapPin } from "lucide-react";
import { EmptyState } from "../../../../components/States";
import {
  normalizeCalcMuestraAulasExploracion,
  normalizeCalcMuestraAulasParticularidades,
  type CalcMuestraAulasExploracionFacultad,
  type CalcMuestraAulasState,
  type CalcMuestraWorkspace,
} from "../../../../api/client";
import { fmtInt, fmtPct, rowsFrom } from "../../sharedCore";
import { classroomSelectionRowsForState } from "../shared/frame";
import { normalizeUniversityLabel } from "../shared/format";
import { workspaceCategoryLabel } from "../shared/categorias";
import { CifraFila, CifraMotor } from "../ui";
import {
  EXPLORADOR_SORT_DEFAULT,
  contrasteSeleccion,
  cursoRowsDesdeAulaFrame,
  cursoRowsDesdeExploracion,
  filtrarFacultades,
  formulaEfectivos,
  ordenarCursos,
  toggleCursoSort,
  type ExploradorCursoSort,
  type ExploradorCursoSortKey,
} from "./exploradorModel";
import { FacultadRadiografiaCard } from "./FacultadRadiografiaCard";
import "./marco.css";

const SORT_COLUMNS: Array<{ key: ExploradorCursoSortKey; label: string; numeric: boolean }> = [
  { key: "curso", label: "Curso", numeric: false },
  { key: "nivel", label: "Nivel", numeric: false },
  { key: "tipo", label: "Tipo", numeric: false },
  { key: "elegibles", label: "Elegibles", numeric: true },
  { key: "share", label: "% misma facultad", numeric: true },
  { key: "efectivos", label: "Elegibles efectivos", numeric: true },
];

export function ExploradorAulasTab({
  workspace,
  aulasState,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
}) {
  const frame = aulasState?.frame ?? null;
  const exploracion = useMemo(
    () => normalizeCalcMuestraAulasExploracion(frame?.exploracion ?? null),
    [frame?.exploracion],
  );
  const particularidades = useMemo(
    () => normalizeCalcMuestraAulasParticularidades(frame?.particularidades ?? null),
    [frame?.particularidades],
  );
  const [query, setQuery] = useState("");
  const [facultadActiva, setFacultadActiva] = useState("");
  const [sort, setSort] = useState<ExploradorCursoSort>(EXPLORADOR_SORT_DEFAULT);
  const [verTodos, setVerTodos] = useState(false);

  const facultades = useMemo(
    () => (exploracion ? filtrarFacultades(exploracion.por_facultad, query) : []),
    [exploracion, query],
  );
  const seleccionada: CalcMuestraAulasExploracionFacultad | null = useMemo(() => {
    if (!facultades.length) return null;
    const target = normalizeUniversityLabel(facultadActiva);
    return facultades.find((fac) => normalizeUniversityLabel(fac.facultad) === target) ?? facultades[0];
  }, [facultades, facultadActiva]);

  const aulaFrameRows = useMemo(
    () => rowsFrom<Record<string, unknown>>(frame?.aula_frame),
    [frame?.aula_frame],
  );
  const cursosCompletos = useMemo(
    () =>
      seleccionada
        ? cursoRowsDesdeAulaFrame(
            aulaFrameRows,
            seleccionada.facultad,
            particularidades,
            (raw) => workspaceCategoryLabel(workspace, "faculty", raw),
          )
        : [],
    [aulaFrameRows, seleccionada, particularidades, workspace],
  );
  const puedeVerTodos = Boolean(seleccionada && cursosCompletos.length > seleccionada.top_cursos.length);
  const cursos = useMemo(() => {
    if (!seleccionada) return [];
    const base = verTodos && puedeVerTodos ? cursosCompletos : cursoRowsDesdeExploracion(seleccionada);
    return ordenarCursos(base, sort);
  }, [seleccionada, verTodos, puedeVerTodos, cursosCompletos, sort]);

  const contraste = useMemo(
    () => (exploracion ? contrasteSeleccion(classroomSelectionRowsForState(aulasState), exploracion) : []),
    [aulasState, exploracion],
  );

  if (!exploracion) {
    return (
      <div className="cmv2-marco-stack cmv2-explorador" data-audit-ready="false">
        <EmptyState
          icon={<Compass size={20} />}
          title="Reconstruye el marco para generar la radiografía"
          hint="La exploración por facultad (tipos de curso, locales externos y rendimiento por aula) se calcula junto con el marco. Ve a Criterios de inclusión y usa «Reconstruir» con tu base cargada."
        />
      </div>
    );
  }

  return (
    <div className="cmv2-marco-stack cmv2-explorador" data-audit-ready="true">
      <section className="cmv2-panel cmv2-explorador-head">
        <div className="cmv2-marco-aulas-lead">
          <span className="cmv2-eyebrow">Explorador de aulas</span>
          <strong>Radiografía del marco para elegir con conocimiento del terreno</strong>
          <p className="cmv2-explorador-mision">
            Qué tipo de curso concentra a los alumnos en cada facultad, qué cursos se dictan fuera del
            campus y dónde rinde más cada aula.
          </p>
        </div>
        <CifraFila>
          <CifraMotor
            label="Facultades"
            value={fmtInt(exploracion.totales.facultades)}
            detalle="con cursos-horario en el marco"
            origen="motor"
            hero
          />
          <CifraMotor
            label="CH elegibles"
            value={fmtInt(exploracion.totales.ch_elegibles)}
            detalle={`de ${fmtInt(exploracion.totales.ch_total)} cursos-horario detectados`}
            origen="motor"
          />
          <CifraMotor
            label="Elegibles"
            value={fmtInt(exploracion.totales.elegibles_total)}
            detalle="alumnos elegibles en el marco"
            origen="motor"
          />
          <CifraMotor
            label="Locales externos"
            value={fmtInt(exploracion.totales.n_local_externo)}
            detalle={`cursos fuera del campus · ${fmtInt(exploracion.totales.n_multi_facultad)} multi-facultad`}
            origen="motor"
          />
        </CifraFila>
        {contraste.length > 0 && (
          <div className="cmv2-explorador-contraste" role="group" aria-label="Contraste con la selección de titulares">
            <span className="cmv2-explorador-contraste-titulo">Contraste con la selección</span>
            <ul>
              {contraste.map((row) => (
                <li key={row.facultad}>
                  <strong>{row.facultad}</strong>
                  <span>
                    {fmtInt(row.titulares)} {row.titulares === 1 ? "titular" : "titulares"} de {fmtInt(row.chElegibles)} CH elegibles
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="cmv2-panel cmv2-explorador-facultades" aria-label="Perfil del marco por facultad">
        <div className="cmv2-explorador-toolbar">
          <div className="cmv2-marco-aulas-lead">
            <span className="cmv2-eyebrow">Perfil por facultad</span>
            <strong>Dónde están los alumnos de cada facultad</strong>
          </div>
          <label className="cmv2-compact-field cmv2-explorador-buscador">
            <span>Buscar facultad</span>
            <input
              type="search"
              value={query}
              placeholder="nombre de la facultad…"
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </label>
        </div>
        {facultades.length === 0 ? (
          <p className="cmv2-explorador-sin-resultados">
            Ninguna facultad coincide con «{query.trim()}».
          </p>
        ) : (
          <div className="cmv2-explorador-facultades-scroll">
            <div className="cmv2-explorador-cards">
              {facultades.map((fac) => (
                <FacultadRadiografiaCard
                  key={fac.facultad}
                  fac={fac}
                  active={seleccionada?.facultad === fac.facultad}
                  onSelect={() => {
                    setFacultadActiva(fac.facultad);
                    setVerTodos(false);
                    setSort(EXPLORADOR_SORT_DEFAULT);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {seleccionada && (
        <section className="cmv2-panel cmv2-explorador-detalle" aria-label={`Cursos-horario de ${seleccionada.facultad}`}>
          <div className="cmv2-explorador-toolbar">
            <div className="cmv2-marco-aulas-lead">
              <span className="cmv2-eyebrow">Cursos-horario de la facultad</span>
              <strong>{seleccionada.facultad}</strong>
              <p className="cmv2-explorador-mision">
                {verTodos && puedeVerTodos
                  ? `Los ${fmtInt(cursosCompletos.length)} cursos-horario del marco para esta facultad.`
                  : `Top ${fmtInt(seleccionada.top_cursos.length)} por elegibles. Sin puntajes compuestos: ordena las columnas y revisa la fórmula visible.`}
              </p>
            </div>
            {puedeVerTodos && (
              <button
                type="button"
                className="cmv2-ghost"
                onClick={() => setVerTodos((prev) => !prev)}
              >
                {verTodos
                  ? `Ver top ${fmtInt(seleccionada.top_cursos.length)}`
                  : `Ver todos (${fmtInt(cursosCompletos.length)})`}
              </button>
            )}
          </div>
          <div className="cmv2-table-wrap">
            <table className="cmv2-table cmv2-table--university cmv2-explorador-table">
              <thead>
                <tr>
                  {SORT_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      data-numeric={col.numeric || undefined}
                      aria-sort={sort.key === col.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <button
                        type="button"
                        className="cmv2-explorador-sort"
                        onClick={() => setSort((prev) => toggleCursoSort(prev, col.key))}
                        title={col.key === "efectivos"
                          ? "Elegibles efectivos = elegibles × % misma facultad, redondeado"
                          : undefined}
                      >
                        {col.label}
                        {sort.key === col.key
                          ? sort.dir === "asc"
                            ? <ArrowUp size={11} aria-hidden="true" />
                            : <ArrowDown size={11} aria-hidden="true" />
                          : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cursos.map((curso) => (
                  <tr key={curso.id}>
                    <td>
                      <span className="cmv2-explorador-curso">
                        {curso.curso}
                        {curso.localExterno && (
                          <span className="cmv2-explorador-badge" data-kind="externo">
                            <MapPin size={11} aria-hidden="true" />
                            Local externo
                          </span>
                        )}
                        {curso.multiFacultad && (
                          <span className="cmv2-explorador-badge" data-kind="multi">
                            <Layers3 size={11} aria-hidden="true" />
                            Multi-facultad
                          </span>
                        )}
                      </span>
                    </td>
                    <td>{curso.nivel || "—"}</td>
                    <td>{curso.tipo || "—"}</td>
                    <td data-numeric="true">{fmtInt(curso.elegibles)}</td>
                    <td data-numeric="true">{curso.share != null ? fmtPct(curso.share) : "—"}</td>
                    <td data-numeric="true" title={formulaEfectivos(curso.elegibles, curso.share)}>
                      {curso.efectivos != null ? fmtInt(curso.efectivos) : "—"}
                    </td>
                  </tr>
                ))}
                {cursos.length === 0 && (
                  <tr>
                    <td colSpan={SORT_COLUMNS.length} className="cmv2-explorador-sin-resultados">
                      El contrato no trae cursos para esta facultad.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="cmv2-explorador-nota">
            Elegibles efectivos = elegibles × % misma facultad (redondeado). El detalle por fila está en el
            tooltip de la columna; los cursos multi-facultad aportan parte de sus elegibles a otras cuotas.
          </p>
        </section>
      )}
    </div>
  );
}
