import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { celdasPorFacultad, type CeldaDeFacultad } from "./celdasPorFacultad";
import { fmt } from "./kpisDeAulas";
import "./aulasSexoPorFacultad.css";

/**
 * Cuántos hombres y cuántas mujeres lleva cada facultad, y cuántos le faltan.
 *
 * Sustituye en este panel al gráfico de estratos del sorteo, que dibujaba
 * `FACULTAD · mayoría mujeres · 41 alumnos o más`. Gonzalo: «cómo vas a poner
 * mayoría hombres o mayoría mujeres cuando eso no me interesa; lo que me
 * interesa es cuántos hombres y cuántas mujeres, cómo vamos en cada estrato de
 * cada facultad».
 *
 * **Barras en CSS y no Plotly** (dictado 2026-09-03, mirando este panel: «la
 * diferencia entre hombres y mujeres y la facultad puede ir en boxes, uno de
 * color diferente por facultad y color diferente por hombre y mujer, siguiendo
 * el mismo criterio que el resto de elementos en Monitoreo de aulas… además el
 * hover puede verse mucho mejor y más profesional»). Plotly no sabe pintar
 * chips en el eje ni dejarse diseñar el tooltip; el precedente es el embudo
 * («Barras en CSS y no Plotly: son tres pasos»). Cada fila lleva su facultad y
 * su sexo como CHIPS con los tonos deterministas de la paleta compartida del
 * Sistema Pabellón (`--pulso-accent-*`), y el hover/foco de la fila revela las
 * cifras exactas en línea — el idioma accesible de la malla de Carga, no un
 * tooltip flotante de librería.
 *
 * Los tramos de la barra conservan su semántica de siempre: lo recogido, lo
 * que traerán las aulas EN JUEGO que faltan por aplicar (denominador de
 * `monitoreo_aulas_avance_sexo_facultad()` sobre `tracked_df` — no es «lo
 * agendado», que mide otra tarjeta) y el déficit que quedaría aun así; la
 * cuota se marca como tick de tinta sobre la barra.
 */

/* Los 8 tonos de la paleta compartida (sistemaPabellon.css). El tono de la
   facultad es determinista sobre su NOMBRE COMPLETO: con 15 facultades donde
   seis empiezan con C o E, el criterio por letra inicial del pabellón pintaría
   iguales a CIENCIAS E INGENIERIA y CIENCIAS SOCIALES — mismo espíritu
   (paleta compartida, asignación estable), mejor reparto. */
const TONOS = 8;
function tonoDeFacultad(nombre: string): number {
  let h = 0;
  for (let i = 0; i < nombre.length; i += 1) h = (h * 31 + nombre.charCodeAt(i)) % 997;
  return h % TONOS;
}

/* El sexo con DOS tonos fijos de la misma paleta — el criterio del resto del
   perfil (chips con tono estable), sin caer en el cliché de colores: violeta
   para mujeres, acero para hombres, los dos más distinguibles entre sí. */
const TONO_MUJERES = 4;
const TONO_HOMBRES = 0;

type FilaDeSexo = {
  facultad: string;
  sexo: "Mujeres" | "Hombres";
  logrado: number;
  pendiente: number;
  deficit: number;
  cuota: number;
};

const filasPlanas = (filas: ReadonlyArray<CeldaDeFacultad>): FilaDeSexo[] =>
  filas.flatMap((f) => [
    { facultad: f.facultad, sexo: "Mujeres" as const, logrado: f.mujeresLogrado,
      pendiente: f.mujeresPendiente, deficit: f.mujeresDeficit, cuota: f.mujeresCuota },
    { facultad: f.facultad, sexo: "Hombres" as const, logrado: f.hombresLogrado,
      pendiente: f.hombresPendiente, deficit: f.hombresDeficit, cuota: f.hombresCuota },
  ]);

/**
 * ⚠ SIN MONTAR desde el 2026-09-09 — desconectado, no borrado.
 *
 * Este panel («Qué metas van a cerrar y cuáles no») y el bloque «Metas y aulas»
 * del revamp discrepan en 28 de las 30 celdas facultad × sexo —DERECHO/F 152,9
 * contra 300,9—, porque cuentan universos distintos: aquél proyecta sólo lo
 * AGENDADO y éste cuenta TODOS los cursos-horario en juego, y hay 33 titulares
 * planificados sin fecha. Dos «proyectado» por celda con el doble de diferencia
 * en la misma pantalla no se puede quedar.
 *
 * Lo que este panel dice y el otro no es la CALIBRACIÓN —«el campo está
 * rindiendo un X % menos de lo previsto»—, que merece volver como lectura y no
 * como un segundo panel de proyección. Lo decide Gonzalo; hasta entonces vive
 * aquí, entero y con su test.
 */
export function AulasSexoPorFacultadChart({ celdas, sinFecha = 0 }: {
  celdas: ReadonlyArray<MonitoreoRow>;
  /**
   * Cursos-horario del plan que aún no tienen fecha. Se declara porque la
   * proyección de este panel LOS CUENTA, y el acumulado de «Rendimiento diario»
   * no: sin decirlo, los dos paneles daban conclusiones opuestas de la misma
   * pantalla —aquí las 30 celdas con ✓, allá «no se llega»—.
   */
  sinFecha?: number;
}) {
  const filas = useMemo(() => celdasPorFacultad(celdas), [celdas]);

  if (!filas.length) {
    return (
      // Declara lo mismo que la rama con datos: es la regla que
      // `vaciosDeclarados.contract.test.ts` vigila, y me cazó la omisión por
      // segunda vez hoy.
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        Todavía no hay cuotas por sexo y facultad con las que comparar. Se llenan
        al declarar la cuota del estudio en Cálculo de muestra.
      </p>
    );
  }

  // `celdasPorFacultad` ya ordena por déficit proyectado descendente: la
  // facultad a la que más le falta queda ARRIBA, que es donde cae la vista.
  const planas = filasPlanas(filas);
  // Una sola escala para todas las filas: comparar barras entre sí es para lo
  // que existe el panel. La cuota entra al máximo para que su tick jamás se
  // salga de la pista.
  const max = Math.max(1, ...planas.map((p) => Math.max(p.logrado + p.pendiente + p.deficit, p.cuota)));
  const pct = (n: number) => `${(100 * n) / max}%`;

  const deficitTotal = filas.reduce((s, f) => s + f.deficit, 0);
  const cubiertas = filas.filter((f) => f.deficit === 0).length;
  // Las que ponen algo en ese déficit. `filas.length` son TODAS las del gráfico,
  // incluidas las que ya cerraron.
  const conDeficit = filas.filter((f) => f.deficit > 0).length;

  return (
    // El contenedor de datos del panel «Avance por facultad y sexo». Sin
    // declararlo, el runner cae a los hijos directos del `section` y mide su
    // encabezado como si fuera datos — el patrón que salió siete veces.
    <div className="aulas-cobertura-chart aulas-sexfac" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {/* Dictado 2026-09-03: «¿qué busca hacer o representar?» — la pregunta
          del panel se declara EN el panel, en una línea. */}
      <p className="aulas-sexfac-pregunta">
        ¿Cierra cada facultad su cuota de mujeres y de hombres con lo que queda
        del plan? Cada barra compara lo recogido y lo previsto contra la
        meta, que es la marca de tinta.
        {/* **El supuesto, dicho.** Sin esto el panel marcaba las 30 celdas con
            un ✓ —DERECHO mujeres incluida, con 8 de 237— porque proyecta sobre
            TODOS los cursos-horario en juego. El acumulado de «Rendimiento
            diario» proyecta sólo sobre lo agendado y por eso dice que no se
            llega. Las dos son correctas sobre universos distintos y la
            diferencia entre ellas es exactamente esta cifra. */}
        {sinFecha > 0 ? (
          <>
            {" "}Cuenta <strong>todos</strong> los cursos-horario del plan que siguen en
            juego, tengan fecha o no: hoy <strong>{sinFecha.toLocaleString("es-PE")}</strong>{" "}
            {sinFecha === 1 ? "no la tiene" : "no la tienen"} todavía.
          </>
        ) : null}
      </p>
      <ul className="aulas-sexfac-leyenda" aria-hidden="true">
        <li><i className="es-recogidas" />Recogidas</li>
        {/* En palabras llanas (dictado: «¿qué significa "aportarán los cursos
            horarios que faltan"?»). Sigue SIN decir «agendadas» a propósito:
            el tramo sale de las aulas EN JUEGO sin aplicar (tengan fecha o
            no); «Cierran con lo agendado» proyecta sólo sobre la agenda y es
            otra tarjeta. */}
        <li><i className="es-pendiente" />Efectivas previstas de los cursos-horario que faltan aplicar</li>
        <li><i className="es-deficit" />Faltaría aun así</li>
        <li><i className="es-cuota" />Meta</li>
      </ul>
      <ul className="aulas-sexfac-filas">
        {planas.map((p) => {
          const total = p.logrado + p.pendiente + p.deficit;
          const detalle = `${p.facultad} · ${p.sexo}: ${fmt(p.logrado)} recogidas · `
            + `${fmt(p.pendiente)} efectivas previstas de los cursos-horario que faltan aplicar · `
            + `faltarían ${fmt(p.deficit)} aun así · meta ${fmt(p.cuota)}`;
          return (
            <li key={`${p.facultad}·${p.sexo}`} className="aulas-sexfac-fila">
              <span className="aulas-sexfac-quien">
                <span className={`aulas-chip aulas-chip-lugar es-tono-${tonoDeFacultad(p.facultad)}`} title={p.facultad}>
                  {p.facultad}
                </span>
                <span className={`aulas-chip aulas-chip-lugar aulas-sexfac-sexo es-tono-${p.sexo === "Mujeres" ? TONO_MUJERES : TONO_HOMBRES}`}>
                  {p.sexo}
                </span>
              </span>
              {/* La pista es focuseable: el hover Y el foco revelan las cifras
                  — el equivalente accesible del tooltip, como en la malla. */}
              <span className="aulas-sexfac-pista" tabIndex={0} role="img" aria-label={detalle}>
                <span className="aulas-sexfac-tramos">
                  {p.logrado > 0 && <i className="es-recogidas" style={{ width: pct(p.logrado) }} />}
                  {p.pendiente > 0 && <i className="es-pendiente" style={{ width: pct(p.pendiente) }} />}
                  {p.deficit > 0 && <i className="es-deficit" style={{ width: pct(p.deficit) }} />}
                </span>
                {p.cuota > 0 && <i className="aulas-sexfac-cuota" style={{ left: pct(p.cuota) }} title={`Meta ${fmt(p.cuota)}`} />}
                <em className="aulas-sexfac-cifras" aria-hidden="true">
                  {fmt(p.logrado)} recogidas
                  {p.pendiente > 0 ? <> · <strong className="es-pendiente">+{fmt(p.pendiente)}</strong> previstas</> : null}
                  {p.deficit > 0 ? <> · <strong className="es-deficit">faltarían {fmt(p.deficit)}</strong></> : null}
                  {" "}· meta {fmt(p.cuota)}
                </em>
              </span>
              {/* El déficit a la vista SIN hover, como el «textposition:
                  outside» que tenía el Plotly: el cero no se escribe, que en
                  una celda cubierta competiría con las que sí piden algo. */}
              <span className="aulas-sexfac-saldo">
                {p.deficit > 0 ? fmt(p.deficit) : total >= p.cuota && p.cuota > 0 ? "✓" : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mon-profile-table-recorte">
        {/* **«repartido en» cuenta las que TIENEN déficit, no todas.** Con el
            simulacro de mitad de operativo el déficit total baja a 1 y la frase
            decía «un déficit de 1 respuestas, repartido en 15 facultades»: el 15
            eran todas las del gráfico. Un déficit de 1 está en una facultad, y
            decir quince manda a buscar en catorce sitios donde no hay nada.
            Y la concordancia, que sólo se ve cuando el número baja a uno. */}
        Aplicando todos los cursos-horario que quedan en el plan quedaría un déficit de{" "}
        {fmt(deficitTotal)} {deficitTotal === 1 ? "respuesta" : "respuestas"}
        {conDeficit
          ? <>, repartido en {fmt(conDeficit)}{" "}
            {conDeficit === 1 ? "facultad" : "facultades"}</>
          : null}.
        {cubiertas
          ? ` ${fmt(cubiertas)} ${cubiertas === 1 ? "alcanza" : "alcanzan"} su cuota en los dos sexos.`
          : ""}
      </p>
    </div>
  );
}
