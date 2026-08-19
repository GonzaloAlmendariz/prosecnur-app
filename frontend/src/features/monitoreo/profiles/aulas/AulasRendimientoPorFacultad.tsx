import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { rendimientoPorFacultad } from "./rendimientoPorFacultad";

/**
 * Qué está rindiendo más y qué menos, facultad por facultad.
 *
 * Es el eje que sustituye a «aula válida / no válida». La unidad es la encuesta
 * conseguida, no un porcentaje contra un umbral: un aula grande a media
 * asistencia deja más que una pequeña que «cumple».
 */

const fmt = (n: number) => n.toLocaleString("es-PE");
const pct = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("es-PE")} %`);

export function AulasRendimientoPorFacultad({ partes, plan, clave = "faculty", unidad = "Facultad" }: {
  partes: ReadonlyArray<MonitoreoRow>;
  plan: ReadonlyArray<MonitoreoRow>;
  /** Por qué unidad de esfuerzo se agrupa: facultad, aplicador o franja. */
  clave?: "faculty" | "applied_by" | "franja";
  /** Cómo se llama esa unidad en la cabecera de la lista. */
  unidad?: string;
}) {
  const filas = useMemo(() => rendimientoPorFacultad(partes, plan, clave), [partes, plan, clave]);

  if (!filas.length) {
    return (
      <p className="mon-profile-muted">
        Todavía no hay partes de campo con asistentes ni efectivas, así que no se puede decir
        qué rinde más.
      </p>
    );
  }

  const efectivas = filas.reduce((n, f) => n + f.efectivas, 0);
  const aulas = filas.reduce((n, f) => n + f.aulas, 0);
  const tope = Math.max(...filas.map((f) => f.porAula ?? 0), 1);
  const media = aulas ? Math.round((10 * efectivas) / aulas) / 10 : 0;

  return (
    <div className="aulas-rendimiento">
      <p className="aulas-rendimiento-lectura">
        <strong>{fmt(efectivas)}</strong> encuestas en <strong>{fmt(aulas)}</strong>{" "}
        {aulas === 1 ? "aula visitada" : "aulas visitadas"} ·{" "}
        <strong>{media.toLocaleString("es-PE")}</strong> por aula de media
      </p>
      <ul className="aulas-rendimiento-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <li className="aulas-rendimiento-cabecera" aria-hidden="true">
          <span>{unidad}</span>
          <span>Por aula</span>
          <span>Ajustado</span>
          <span>De los asistentes</span>
          <span>Del potencial</span>
        </li>
        {filas.map((f) => (
          <li key={f.facultad}>
            <span className="aulas-rendimiento-nombre" title={f.facultad}>
              {f.facultad}
              <em>{fmt(f.aulas)} {f.aulas === 1 ? "aula" : "aulas"} · {fmt(f.efectivas)} encuestas</em>
            </span>
            {/* La barra mide POR AULA, que es la pregunta del panel. Escala
                compartida entre facultades: normalizar cada una a sí misma haría
                que todas se vieran iguales. */}
            <span className="aulas-rendimiento-barra" role="img"
              aria-label={`${f.porAula ?? 0} encuestas por aula`}>
              <i style={{
                width: `${Math.max(4, (100 * (f.porAula ?? 0)) / tope)}%`,
                background: (f.porAula ?? 0) >= media ? COLOR_RESULTADO.efectiva : COLOR_RESULTADO.parcial,
              }}>{f.porAula ?? "—"}</i>
            </span>
            {/* Las dos tasas conviven con la barra y NO la sustituyen: miden
                cosas distintas —el trabajo del aplicador y cuánto queda por
                exprimir— y cualquiera de ellas ordenaría mal la lista. */}
            {/* El AJUSTADO al lado del crudo, nunca en su lugar. En el estudio
                real las facultades van de 2 a 39 aulas, y una de dos aulas
                afortunadas encabeza la lista cruda sin merecerlo. */}
            <span className="aulas-rendimiento-tasa">
              {f.porAulaAjustado == null ? "—" : f.porAulaAjustado.toLocaleString("es-PE")}
            </span>
            <span className="aulas-rendimiento-tasa">{pct(f.deLosAsistentes)}</span>
            <span className="aulas-rendimiento-tasa">{pct(f.delPotencial)}</span>
          </li>
        ))}
      </ul>
      <p className="mon-profile-muted aulas-rendimiento-pie">
        Ordenadas por lo que deja cada visita. <strong>De los asistentes</strong> mide el trabajo
        en el aula; <strong>del potencial</strong>, cuánto queda por recoger.{" "}
        {/* Qué es el ajustado, en una línea y con el porqué: sin esto es una
            columna con un número que nadie sabe de dónde sale. */}
        <strong>Ajustado</strong> corrige el tamaño de la muestra: equivale a sumarle a cada
        {" "}{unidad.toLowerCase()} cinco aulas con el rendimiento medio, así una con dos aulas
        afortunadas no encabeza la lista.
      </p>
    </div>
  );
}
