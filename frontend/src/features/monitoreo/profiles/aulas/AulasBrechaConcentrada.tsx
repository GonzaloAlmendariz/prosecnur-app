import { useMemo } from "react";

import { brechaConcentrada } from "./brechaConcentrada";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { fmt } from "./kpisDeAulas";

/**
 * **Dónde se concentra la brecha del sorteo**, de un vistazo.
 *
 * Estratos era una tabla de 73 filas por 5 columnas y nada más: Gonzalo lo dijo
 * el 2026-09-09 mirándola —«ahora esta pestaña es una tabla gigante, nada que
 * ver con los elementos visuales que prometiste»— y tenía razón contra la vara
 * de esta misma sección, que dice que si la pregunta es «quién va peor» eso es
 * un ranking. La tabla se queda debajo, que es donde sirve: se lee buscando UNA
 * fila concreta. Lo que no puede es SER la pestaña.
 *
 * Barras CSS y no Plotly, con las clases que el perfil ya tiene
 * (`aulas-cobertura-*`): `aulasMonitoreo.css` está congelado a crecimiento y
 * además este reparto es el mismo que ya dibuja «Cursos-horario por cobertura»
 * —etiqueta, pista, cifra—, así que inventarle una hoja propia sería divergir
 * por gusto.
 *
 * El denominador va en el panel y no en una nota al pie porque **sin él la
 * cifra contradice a la de arriba**: los 73 estratos suman 3 076 de brecha
 * mientras la banda de KPIs dice «faltan 2 288». Ver `brechaConcentrada.ts`.
 */
export function AulasBrechaConcentrada({
  filas, metaPorCursoHorario,
}: {
  /** `avance_por_estrato` con las etiquetas YA traducidas. */
  filas: ReadonlyArray<Record<string, unknown>>;
  /** La suma de metas por curso-horario, que es contra lo que se mide. */
  metaPorCursoHorario: number | null;
}) {
  const r = useMemo(() => brechaConcentrada(filas), [filas]);

  if (!r.estratos) {
    // C3: el vacío ocupa el mismo hueco que la rama con datos. Si no declara
    // la capacidad, el panel se encoge cuando no hay estratos y el marco salta.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        El sorteo no declara estratos que comparar.
      </p>
    );
  }
  if (!r.brechaTotal) {
    // No es un vacío: es la mejor noticia posible del operativo, y darla como
    // «no hay datos» la haría parecer un fallo.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        Los {fmt(r.estratos)} estratos del sorteo alcanzaron su meta: no queda brecha que repartir.
      </p>
    );
  }

  const tope = Math.max(1, ...r.cabeza.map((e) => e.brecha));
  const detalle = r.cabeza.map((e) => `${e.etiqueta}: faltan ${fmt(e.brecha)}`).join(" · ");

  return (
    <div className="aulas-cobertura-chart aulas-cobertura-css" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-rendimiento-lectura">
        Los <strong>{fmt(r.cabeza.length)}</strong> estratos con más brecha concentran
        el <strong>{r.concentracionPct} %</strong> de lo que falta ·{" "}
        {fmt(r.sinEmpezar)} de {fmt(r.estratos)} todavía sin ninguna respuesta
      </p>
      <ul
        className="aulas-cobertura-filas"
        role="img"
        aria-label={`Estratos del sorteo con más brecha: ${detalle}`}
      >
        {r.cabeza.map((e) => (
          <li key={e.etiqueta}>
            <span className="aulas-cobertura-etiqueta" title={e.etiqueta}>{e.etiqueta}</span>
            <span className="aulas-cobertura-pista">
              <i
                style={{
                  width: `${(100 * e.brecha) / tope}%`,
                  // Ámbar el que falta; el verde de las recogidas no cabe en la
                  // misma pista sin mentir sobre la escala, y la cifra de
                  // recogidas ya viaja en la etiqueta de cada fila.
                  background: COLOR_RESULTADO[e.validas > 0 ? "parcial" : "pendiente"],
                }}
              />
            </span>
            <span className="aulas-cobertura-n">{fmt(e.brecha)}</span>
          </li>
        ))}
      </ul>
      <p className="mon-profile-table-recorte">
        {r.restantes > 0 ? (
          <>
            Otros {fmt(r.restantes)} estratos se reparten las {fmt(r.brechaRestante)} restantes;
            están todos en la tabla de abajo.{" "}
          </>
        ) : null}
        {/* **Esto no es una nota al pie: es lo que impide leer mal el panel.** */}
        Se mide contra la meta por curso-horario
        {metaPorCursoHorario ? <> ({fmt(metaPorCursoHorario)})</> : null}, no contra la cuota del
        estudio: un estrato es facultad × sexo × tamaño y sus brechas no se compensan entre
        tramos de tamaño, así que esta suma es mayor que el «faltan» de la banda de arriba.
      </p>
    </div>
  );
}
