import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { personasPorAula } from "./redondeoConservador";
import { rendimientoPorFacultad } from "./rendimientoPorFacultad";
import { NombreDeFacultad } from "./NombreDeFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import { fmt } from "./kpisDeAulas";

/**
 * Qué está rindiendo más y qué menos, facultad por facultad.
 *
 * Es el eje que sustituye a «aula válida / no válida». La unidad es la encuesta
 * conseguida, no un porcentaje contra un umbral: un aula grande a media
 * asistencia deja más que una pequeña que «cumple».
 */

const pct = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("es-PE")} %`);

export function AulasRendimientoPorFacultad({
  partes, plan, clave = "faculty", unidad = "Facultad", explicaLasColumnas = true,
  facultadEnFoco, onFoco,
}: {
  partes: ReadonlyArray<MonitoreoRow>;
  plan: ReadonlyArray<MonitoreoRow>;
  /** Por qué unidad de esfuerzo se agrupa: facultad, aplicador o franja. */
  clave?: "faculty" | "applied_by" | "franja" | "dia_semana";
  /** Cómo se llama esa unidad en la cabecera de la lista. */
  unidad?: string;
  /**
   * La facultad enfocada, si la hay. **No filtra: resalta.** `foco` viaja en la
   * URL y sólo lo obedecía la tabla de cuotas, teniendo el perfil seis listas de
   * las mismas veinte facultades. Filtrar destruiría el ranking, que es lo que
   * estas listas aportan; el detalle se filtra, el control no.
   */
  facultadEnFoco?: string;
  /** Pulsar un nombre pone el foco. Sin esto, los nombres son sólo texto. */
  onFoco?: (foco: FocoDeCuota) => void;

  /**
   * Si este panel lleva el pie que explica las cuatro columnas.
   *
   * Las tres vistas —facultad, aplicador, franja— comparten componente Y
   * columnas, y salen **una detrás de otra en la misma pantalla**: el pie se
   * repetía palabra por palabra tres veces, 191 de las 896 palabras de prosa de
   * la pestaña. Dentro de un panel ese pie NO sobra —nombra cuatro columnas que
   * no se explican en ningún otro sitio—; lo que sobra es decirlo tres veces.
   * Lo lleva el primero y los otros dos lo heredan por vecindad.
   */
  explicaLasColumnas?: boolean;
}) {
  const filas = useMemo(() => rendimientoPorFacultad(partes, plan, clave), [partes, plan, clave]);

  if (!filas.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
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
      {/* La lectura habla de ESTA agrupación, no del total.
          Las tres vistas —facultad, aplicador, franja— comparten componente, y
          con el total salía la MISMA frase palabra por palabra en los tres
          paneles seguidos: «4 863 encuestas en 210 aulas visitadas · 23,2 por
          aula de media», tres veces. Repetida así se lee como un fallo y
          desperdicia la única línea que puede decir qué enseña cada corte.
          El total sigue estando: es el «de media» del final. */}
      <p className="aulas-rendimiento-lectura">
        {/* Sin género: el mismo componente sirve a facultad, aplicador y franja,
            y «la que más rinde (Equipo 4)» no concuerda. «De X a Y» vale para
            los tres y además es más corto. */}
        {filas.length > 1 ? (
          <>
            De <strong>{personasPorAula(filas[0].porAula)}</strong> por aula ({filas[0].facultad}) a{" "}
            <strong>{personasPorAula(filas[filas.length - 1].porAula)}</strong>{" "}
            ({filas[filas.length - 1].facultad})
          </>
        ) : (
          <>Todo el trabajo está en <strong>{filas[0].facultad}</strong></>
        )}
        {" "}· <strong>{personasPorAula(media)}</strong> de media en{" "}
        {fmt(aulas)} {aulas === 1 ? "aula visitada" : "aulas visitadas"}
      </p>
      {/* SEMÁNTICA DE TABLA SOBRE LA REJILLA, no `<table>`.
          La cabecera iba con `aria-hidden="true"`, así que un lector de pantalla
          recibía 21 filas de cinco cifras SIN un solo nombre de columna —medido
          en vivo el 2026-08-26—. La reparación de la tabla de Efectividad fue
          volver a `<table>`; aquí no, y es una decisión, no un atajo: esta
          rejilla la comparten CUATRO instancias (facultad, aplicador, franja,
          día) y una variante compacta cuyos anchos están calculados desde la
          palabra más larga de cada cabecera. Reescribirla como tabla rehace esa
          geometría en dos regímenes a la vez, y el defecto que hay que reparar
          es de nombres, no de maquetación. Los roles ARIA dan los nombres sin
          tocar un píxel. */}
      <ul className="aulas-rendimiento-lista" role="table"
        aria-label={`Rendimiento por ${unidad.toLowerCase()}`}
        data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <li className="aulas-rendimiento-cabecera" role="row">
          <span role="columnheader">{unidad}</span>
          <span role="columnheader">Por aula</span>
          <span role="columnheader">Ajustado</span>
          <span role="columnheader">De los asistentes</span>
          <span role="columnheader">Del potencial</span>
        </li>
        {filas.map((f) => (
          <li key={f.facultad} role="row"
            className={clave === "faculty" && f.facultad === facultadEnFoco ? "es-en-foco" : undefined}>
            {/* Sólo es control cuando agrupa POR FACULTAD: en las otras lentes
                la fila es una franja o un día, y poner el foco de facultad desde
                ahí pondría el nombre de una franja donde va una facultad. */}
            {/* `rowheader`: identifica la fila, igual que un `th scope="row"`. */}
            <NombreDeFacultad facultad={f.facultad} className="aulas-rendimiento-nombre"
              rol="rowheader"
              enFoco={clave === "faculty" && f.facultad === facultadEnFoco}
              onFoco={clave === "faculty" ? onFoco : undefined}>
              {f.facultad}
              <em>{fmt(f.aulas)} {f.aulas === 1 ? "aula" : "aulas"} · {fmt(f.efectivas)} encuestas</em>
            </NombreDeFacultad>
            {/* La barra mide POR AULA, que es la pregunta del panel. Escala
                compartida entre facultades: normalizar cada una a sí misma haría
                que todas se vieran iguales. */}
            {/* La celda lleva el rol y la barra de dentro sigue siendo la
                imagen con su alternativa: si el `role="img"` se pusiera en la
                celda, el lector perdería la posición en la fila. */}
            <span role="cell" className="aulas-rendimiento-barra-celda">
            <span className="aulas-rendimiento-barra" role="img"
              aria-label={`${personasPorAula(f.porAula)} encuestas por aula`}>
              <i style={{
                width: `${Math.max(4, (100 * (f.porAula ?? 0)) / tope)}%`,
                background: (f.porAula ?? 0) >= media ? COLOR_RESULTADO.efectiva : COLOR_RESULTADO.parcial,
              }}>{personasPorAula(f.porAula)}</i>
            </span>
            </span>
            {/* Las dos tasas conviven con la barra y NO la sustituyen: miden
                cosas distintas —el trabajo del aplicador y cuánto queda por
                exprimir— y cualquiera de ellas ordenaría mal la lista. */}
            {/* El AJUSTADO al lado del crudo, nunca en su lugar. En el estudio
                real las facultades van de 2 a 39 aulas, y una de dos aulas
                afortunadas encabeza la lista cruda sin merecerlo. */}
            <span role="cell" className="aulas-rendimiento-tasa">
              {personasPorAula(f.porAulaAjustado)}
            </span>
            <span role="cell" className="aulas-rendimiento-tasa">{pct(f.deLosAsistentes)}</span>
            <span role="cell" className="aulas-rendimiento-tasa">{pct(f.delPotencial)}</span>
          </li>
        ))}
      </ul>
      {/* El pie explica las columnas EN SU ORDEN y con SU NOMBRE.
          Antes decía «ordenadas por lo que deja cada visita» —que es la columna
          «Por aula» llamada de otra forma, dos nombres para lo mismo dentro del
          mismo panel— y explicaba asistentes y potencial antes que «Ajustado»,
          que va en medio: quien lee tenía que saltar. */}
      <p className="mon-profile-muted aulas-rendimiento-pie">
        {explicaLasColumnas ? (
          <>
            <strong>Por aula</strong> es lo que deja cada visita, y por eso ordena la lista.{" "}
            <strong>Ajustado</strong> corrige el tamaño de la muestra: equivale a sumarle a cada{" "}
            {unidad.toLowerCase()} cinco aulas con el rendimiento medio, así una con dos aulas
            afortunadas no encabeza. <strong>De los asistentes</strong> mide el trabajo en el aula;{" "}
            <strong>del potencial</strong>, cuánto queda por recoger.
          </>
        ) : null}
        {/* **De dónde salen los tramos.** Sin decirlo, ver «7:00 – 9:00» con 26
            aulas junto a «9:01 – 19:00» con 161 se lee como un corte arbitrario
            y mal hecho. Son los del equipo —la hoja «planilla» del libro— y por
            eso no se retocan: usar otros haría que la app y su Excel hablaran de
            horarios distintos. */}
        {clave === "franja" ? (
          <> Los tramos son los del <strong>libro del operativo</strong>, no un corte de la
          app: por eso uno cubre dos horas y otro diez.</>
        ) : null}
      </p>
    </div>
  );
}
