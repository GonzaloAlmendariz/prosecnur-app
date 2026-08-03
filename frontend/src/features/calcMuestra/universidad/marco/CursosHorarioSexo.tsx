/**
 * Sexo por curso-horario (Marco → Cursos-horario). Rediseño: primero se elige
 * la facultad; luego se listan sus cursos-horario ordenados por nº de elegibles
 * (mayor primero, con opción de invertir) y se muestran barras AGRUPADAS de
 * hombres y mujeres por curso-horario, dentro de un contenedor deslizable.
 * La lógica vive en cursosHorarioModel.ts; aquí solo se presenta.
 */
import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import type { CalcMuestraAulasState, CalcMuestraWorkspace } from "../../../../api/client";
import { fmtInt, rowsFrom } from "../../sharedCore";
import { sexSeriesCssColorForKind } from "../../sexoPalette";
import {
  cursoHorarioSexRows,
  defaultCursoHorarioFaculty,
  facultyOptionsForCursos,
  orderCursoHorarioSexRows,
  type CursoHorarioSexOrder,
} from "./cursosHorarioModel";
import { DescriptiveEmptyNotice, descriptiveMissingState } from "./marcoCharts";

type MarcoFrame = CalcMuestraAulasState["frame"] | null;

const SEX_SERIES: Array<{ key: "hombres" | "mujeres"; label: string; kind: "male" | "female" }> = [
  { key: "hombres", label: "Hombres", kind: "male" },
  { key: "mujeres", label: "Mujeres", kind: "female" },
];

export function CursosHorarioSexo({
  frame,
  workspace,
}: {
  frame: MarcoFrame;
  workspace: CalcMuestraWorkspace;
}) {
  const rows = useMemo(
    () => cursoHorarioSexRows(rowsFrom<Record<string, unknown>>(frame?.aula_frame), workspace),
    [frame, workspace],
  );
  const facultyOptions = useMemo(() => facultyOptionsForCursos(rows), [rows]);
  const defaultFaculty = useMemo(() => defaultCursoHorarioFaculty(rows), [rows]);
  const [facultyChoice, setFacultyChoice] = useState("");
  const [order, setOrder] = useState<CursoHorarioSexOrder>("desc");

  const activeFaculty = facultyChoice && facultyOptions.includes(facultyChoice)
    ? facultyChoice
    : facultyOptions.length
      ? defaultFaculty || facultyOptions[0]
      : "";

  const visible = useMemo(
    () => orderCursoHorarioSexRows(rows, activeFaculty, order),
    [rows, activeFaculty, order],
  );

  // F29 · Medido: el contenedor tenía 39.899 px de filas dentro de una ventana
  // de 360 px —110 pantallas, 10.278 palabras—. Una lista que hay que recorrer
  // 110 veces no sostiene ninguna decisión, y el orden ya pone delante lo que
  // importa (mayor o menor tamaño). Se muestra una ventana legible y la
  // profundidad se declara, en vez de esconderla en la barra de scroll. No se
  // agrega ni se resume nada: son las mismas filas del motor, acotadas.
  const [verTodos, setVerTodos] = useState(false);
  const TOPE = 40;
  const recortada = !verTodos && visible.length > TOPE;
  const filas = recortada ? visible.slice(0, TOPE) : visible;
  const maxSex = visible.reduce((peak, row) => Math.max(peak, row.hombres, row.mujeres), 0) || 1;

  if (!rows.length) {
    return (
      <section className="cmv2-panel cmv2-ch-sexo">
        <div className="cmv2-panel-head">
          <strong>Sexo por curso-horario</strong>
        </div>
        <DescriptiveEmptyNotice
          state={descriptiveMissingState(workspace, {
            role: "sex",
            variable: "Sexo o género",
            source: "catálogo de cursos-horario",
            hasSource: false,
            impact: "Permite leer la composición esperada de hombres y mujeres en cada curso-horario.",
            next: "Revisa Definición > Variables y vincula la columna Sexo o género.",
          })}
        />
      </section>
    );
  }

  return (
    <section className="cmv2-panel cmv2-ch-sexo">
      <div className="cmv2-ch-sexo-head">
        <div className="cmv2-ch-sexo-title">
          <strong>Sexo por curso-horario</strong>
          <span>hombres y mujeres esperados en cada curso-horario de la facultad elegida</span>
        </div>
        <div className="cmv2-ch-sexo-controls">
          <label className="cmv2-ch-sexo-select">
            <span>Facultad</span>
            <select value={activeFaculty} onChange={(e) => setFacultyChoice(e.currentTarget.value)}>
              {facultyOptions.map((faculty) => (
                <option key={faculty} value={faculty}>{faculty}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="cmv2-ch-sexo-order"
            onClick={() => setOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
            aria-pressed={order === "asc"}
            title={order === "desc" ? "Orden actual: más grandes primero" : "Orden actual: más pequeños primero"}
          >
            <ArrowUpDown size={13} aria-hidden="true" />
            {order === "desc" ? "Mayor tamaño" : "Menor tamaño"}
          </button>
        </div>
      </div>
      <div className="cmv2-native-legend cmv2-ch-sexo-legend" aria-hidden="true">
        {SEX_SERIES.map((serie) => (
          <span key={serie.key}><i style={{ background: sexSeriesCssColorForKind(serie.kind) }} />{serie.label}</span>
        ))}
      </div>
      <div
        className="cmv2-ch-sexo-scroll"
        role="img"
        aria-label={`Hombres y mujeres por curso-horario en ${activeFaculty || "todas las facultades"}, ${visible.length} cursos-horario`}
      >
        {filas.map((row) => (
          <div key={row.id} className="cmv2-ch-sexo-row">
            <div className="cmv2-ch-sexo-label">
              <strong title={row.label}>{row.label}</strong>
              <span>{row.detail || `${fmtInt(row.eligibles)} elegibles`}</span>
            </div>
            <div className="cmv2-ch-sexo-bars">
              {SEX_SERIES.map((serie) => {
                const value = row[serie.key];
                const widthPct = Math.max(value > 0 ? 3 : 0, (value / maxSex) * 100);
                return (
                  <div key={serie.key} className="cmv2-ch-sexo-bar">
                    <i style={{ width: `${widthPct}%`, background: sexSeriesCssColorForKind(serie.kind) }} aria-hidden="true" />
                    <strong>{fmtInt(value)}</strong>
                  </div>
                );
              })}
            </div>
            <div className="cmv2-ch-sexo-total">
              <strong>{fmtInt(row.eligibles)}</strong>
              <span>elegibles</span>
            </div>
          </div>
        ))}
      </div>
      {visible.length > TOPE && (
        <p className="cmv2-ch-sexo-depth">
          <span>
            {recortada
              ? `Mostrando los ${TOPE} de mayor tamaño · ${fmtInt(visible.length)} cursos-horario en ${activeFaculty || "el marco"}`
              : `Mostrando los ${fmtInt(visible.length)} cursos-horario de ${activeFaculty || "el marco"}`}
          </span>
          <button type="button" onClick={() => setVerTodos((v) => !v)}>
            {recortada ? "Ver todos" : `Volver a ${TOPE}`}
          </button>
        </p>
      )}
    </section>
  );
}
