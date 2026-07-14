/**
 * Inventario de únicos (fase Datos → Consistencia). Panel de AUDITORÍA que ayuda
 * a validar los conteos base antes de aplicar criterios: cuántas filas crudas se
 * leyeron y a cuántos alumnos y cursos-horario ÚNICOS colapsan. La base cruda se
 * repite (un CH por múltiples docentes/carreras; un alumno por cada CH en que
 * está matriculado), así que el valor de la vista es hacer legible ese colapso.
 * La lógica vive en inventarioUnicosModel.ts; aquí solo se presenta.
 */
import { CalendarRange, GitMerge, Rows3, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { CalcMuestraAulasState } from "../../../../api/client";
import { fmtDec, fmtInt } from "../../sharedCore";
import { computeInventarioUnicos, type DedupTrack } from "./inventarioUnicosModel";

function DedupTrackCard({
  tono,
  icon,
  titulo,
  unidadPlural,
  filasLeidas,
  track,
  razonLeyenda,
  nota,
}: {
  tono: "alumno" | "aula";
  icon: ReactNode;
  titulo: string;
  unidadPlural: string;
  filasLeidas: number;
  track: DedupTrack;
  razonLeyenda: string;
  nota: string;
}) {
  // Ancho mínimo visible para que la barra de únicos no desaparezca cuando el
  // colapso es fuerte (p. ej. 5,263 sobre 136,284 filas ≈ 4%).
  const anchoUnicos = Math.max(track.fraccionUnica * 100, track.unicos > 0 ? 6 : 0);
  return (
    <article className="cmv2-inv-track" data-tono={tono}>
      <header>
        <span className="cmv2-inv-track-icon" aria-hidden="true">{icon}</span>
        <div>
          <small>{titulo}</small>
          <strong>{fmtInt(track.unicos)}</strong>
        </div>
      </header>
      <div
        className="cmv2-inv-bars"
        role="img"
        aria-label={`${fmtInt(filasLeidas)} filas leídas colapsan a ${fmtInt(track.unicos)} ${unidadPlural}`}
      >
        <div className="cmv2-inv-bar is-crudo">
          <i style={{ width: "100%" }} />
          <label>
            <span>Filas leídas</span>
            <b>{fmtInt(filasLeidas)}</b>
          </label>
        </div>
        <div className="cmv2-inv-bar is-unico">
          <i style={{ width: `${anchoUnicos}%` }} />
          <label>
            <span>{unidadPlural} únicos</span>
            <b>{fmtInt(track.unicos)}</b>
          </label>
        </div>
      </div>
      <div className="cmv2-inv-track-stats">
        <div className="cmv2-inv-merma">
          <GitMerge size={13} aria-hidden="true" />
          <span>
            <b>−{fmtInt(track.colapso)}</b> filas consolidadas
          </span>
        </div>
        <div className="cmv2-inv-razon">
          <b>{track.filasPorUnidad > 0 ? `${fmtDec(track.filasPorUnidad, 1)}×` : "—"}</b>
          <span>{razonLeyenda}</span>
        </div>
      </div>
      <p className="cmv2-inv-track-nota">{nota}</p>
    </article>
  );
}

export function InventarioUnicosPanel({
  aulasState,
}: {
  aulasState: CalcMuestraAulasState | null;
}) {
  const inventario = computeInventarioUnicos(aulasState?.frame ?? null);
  if (!inventario.hasData) return null;

  const { filasLeidas, alumnos, cursosHorario, matriculasElegibles, matriculasPorAlumno } = inventario;

  return (
    <section className="cmv2-panel cmv2-inv" aria-label="Inventario de únicos de la base leída">
      <header className="cmv2-inv-head">
        <span className="cmv2-inv-head-icon" aria-hidden="true"><Rows3 size={15} /></span>
        <div>
          <strong>Inventario de únicos</strong>
          <small>
            La base cruda se repite: un mismo curso-horario aparece en varias filas (más de un docente o
            carrera) y un mismo alumno aparece una vez por cada curso-horario en que está matriculado. Valida
            aquí a cuántas unidades únicas colapsa antes de aplicar criterios.
          </small>
        </div>
        <div className="cmv2-inv-head-crudo" role="img" aria-label={`${fmtInt(filasLeidas)} filas leídas`}>
          <b>{fmtInt(filasLeidas)}</b>
          <span>filas leídas</span>
        </div>
      </header>

      <div className="cmv2-inv-tracks">
        <DedupTrackCard
          tono="alumno"
          icon={<Users size={15} />}
          titulo="Alumnos únicos"
          unidadPlural="Alumnos"
          filasLeidas={filasLeidas}
          track={alumnos}
          razonLeyenda="filas por alumno (matriculado en varios cursos-horario)"
          nota="Deduplicación por estudiante sobre todas las filas leídas, sin filtrar por elegibilidad."
        />
        <DedupTrackCard
          tono="aula"
          icon={<CalendarRange size={15} />}
          titulo="Cursos-horario únicos"
          unidadPlural="Cursos-horario"
          filasLeidas={filasLeidas}
          track={cursosHorario}
          razonLeyenda="filas por curso-horario (repetido por docentes, carreras y alumnos matriculados)"
          nota="Cada curso-horario se colapsa a UNA unidad, uniendo sus filas de docente y carrera."
        />
      </div>

      {matriculasElegibles > 0 && (
        <p className="cmv2-inv-bridge">
          Los <b>{fmtInt(cursosHorario.unicos)}</b> cursos-horario agrupan <b>{fmtInt(matriculasElegibles)}</b>{" "}
          matrículas elegibles (alumno × curso-horario)
          {matriculasPorAlumno > 0 && (
            <>, ≈ <b>{fmtDec(matriculasPorAlumno, 1)}</b> por alumno</>
          )}
          : por eso la base tiene muchas más filas que alumnos o cursos-horario.
        </p>
      )}
    </section>
  );
}
