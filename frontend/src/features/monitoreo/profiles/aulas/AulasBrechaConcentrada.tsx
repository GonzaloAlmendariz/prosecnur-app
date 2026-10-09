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
export function AulasBrechaConcentrada({ filas }: {
  /** `avance_sexo_facultad`: las 30 celdas de facultad × sexo del alumno. */
  filas: ReadonlyArray<Record<string, unknown>>;
}) {
  const r = useMemo(() => brechaConcentrada(filas), [filas]);

  if (!r.celdas) {
    // C3: el vacío ocupa el mismo hueco que la rama con datos. Si no declara
    // la capacidad, el panel se encoge cuando no hay estratos y el marco salta.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
El estudio no declara cuotas de facultad y sexo que comparar.
      </p>
    );
  }
  if (!r.faltaTotal) {
    // No es un vacío: es la mejor noticia posible del operativo, y darla como
    // «no hay datos» la haría parecer un fallo.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
Los {fmt(r.celdas)} grupos de facultad y sexo alcanzaron su cuota: no queda nada que repartir.
      </p>
    );
  }

  const tope = Math.max(1, ...r.cabeza.map((c) => c.falta));
  const detalle = r.cabeza.map((c) => `${c.etiqueta}: faltan ${fmt(c.falta)}`).join(" · ");

  return (
    <div className="aulas-cobertura-chart aulas-cobertura-css" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-rendimiento-lectura">
        Los <strong>{fmt(r.cabeza.length)}</strong> grupos con más por recoger concentran
        el <strong>{r.concentracionPct} %</strong> de lo que falta ·{" "}
        {fmt(r.sinEmpezar)} de {fmt(r.celdas)} todavía sin ninguna respuesta
      </p>
      <ul
        className="aulas-cobertura-filas"
        role="img"
        aria-label={`Grupos de facultad y sexo con más por recoger: ${detalle}`}
      >
        {r.cabeza.map((c) => (
          <li key={c.etiqueta}>
            <span className="aulas-cobertura-etiqueta" title={`${c.etiqueta}: ${fmt(c.logrado)} de ${fmt(c.cuota)}`}>{c.etiqueta}</span>
            <span className="aulas-cobertura-pista">
              <i
                style={{
                  width: `${(100 * c.falta) / tope}%`,
                  // Ámbar el que falta; el verde de las recogidas no cabe en la
                  // misma pista sin mentir sobre la escala, y la cifra de
                  // recogidas ya viaja en la etiqueta de cada fila.
                  background: COLOR_RESULTADO[c.logrado > 0 ? "parcial" : "pendiente"],
                }}
              />
            </span>
            <span className="aulas-cobertura-n">{fmt(c.falta)}</span>
          </li>
        ))}
      </ul>
      <p className="mon-profile-table-recorte">
        {r.restantes > 0 ? (
          <>
            Otros {fmt(r.restantes)} grupos se reparten las {fmt(r.faltaRestante)} restantes.{" "}
          </>
        ) : null}
        {/* Se dice que CUADRA, y no es de adorno: la versión anterior de este
            panel iba sobre la clave del sorteo y sumaba 3 076 contra el «faltan
            2 288» de la banda. Sobre el estrato de verdad no hay tal descuadre,
            y decirlo es lo que evita que alguien vuelva a «arreglarlo». */}
        Los {fmt(r.celdas)} grupos suman lo mismo que la banda de arriba: son las cuotas del
        estudio por facultad y sexo, el reparto que decide si el operativo cierra.
      </p>
    </div>
  );
}
