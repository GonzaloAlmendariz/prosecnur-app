import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { avanceEnRespuestas } from "./avanceEnRespuestas";
import { fmt, fmtCuenta } from "./kpisDeAulas";

/**
 * Cuánto se lleva de la meta del plan, en respuestas.
 *
 * Encabeza Avance porque es la primera pregunta de la sección —¿se está
 * cumpliendo?— y hasta ahora sólo se podía contestar a ojo, restando la meta a
 * las válidas, que da un número equivocado.
 *
 * Barra en CSS y no Plotly, como el histórico: es una lectura de tres tramos.
 */

export function AulasAvanceEnRespuestas({ filas, resumen, validasTotales = 0 }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /**
   * El agregado del motor, cuando viene. Se prefiere SIEMPRE al cálculo local:
   * éste suma sobre `course_status`, que el motor recorta a 500 filas, así que
   * sobre un plan de 2 615 enseñaría la meta de un subconjunto arbitrario
   * presentada como el total del estudio. Es el mismo defecto que ya obligó a
   * mover el perfil por facultad al motor.
   */
  resumen?: {
    meta: number; validas: number; cubierto: number; excedente: number;
    falta: number; aulas_con_brecha: number; sin_meta: number;
  } | null;
  /**
   * Las respuestas válidas del corte, del KPI. Sirve para explicar el hueco
   * entre «3 700 válidas» y «0 de 3 743»: sin ella, la pantalla enseña las dos
   * cifras juntas y se lee como una avería.
   */
  validasTotales?: number;
}) {
  const a = useMemo(() => {
    if (resumen && Number(resumen.meta) > 0) {
      // **El resumen del motor entra CRUDO y se normaliza aquí, no al pintar.**
      //
      // El cálculo local ya redondea por aula (`Math.ceil` sobre `expected_valid`),
      // pero el agregado del motor suma las fracciones y llegaba tal cual al
      // render: la pantalla decía «1 306,3 cubren meta» y «504,7 de más». Media
      // respuesta no existe. La dirección va por rubro, no pareja:
      //
      // - lo CONSEGUIDO (`cubierto`, `excedente`) hacia ABAJO — declarar
      //   cubierta la respuesta 1 307 es declarar una que no se consiguió;
      // - la META al entero más próximo — es el objetivo agregado, no una
      //   cuenta de logro ni de deuda;
      // - lo que FALTA se queda crudo: `fmtCuenta` le pone el techo al pintar
      //   (con 1 851 no se cierra una falta de 1 851,5) y el verbo de la frase
      //   sigue a ese número pintado.
      //
      // El epsilon es el de `fmtAporte`: un 1 306 guardado como 1 305,999…9 no
      // debe leerse como 1 305.
      const meta = Math.round(Number(resumen.meta) || 0);
      const cubierto = Math.floor((Number(resumen.cubierto) || 0) + 1e-9);
      return {
        meta,
        validas: Number(resumen.validas) || 0,
        cubierto,
        excedente: Math.floor((Number(resumen.excedente) || 0) + 1e-9),
        falta: Number(resumen.falta) || 0,
        aulasConBrecha: Number(resumen.aulas_con_brecha) || 0,
        sinMeta: Number(resumen.sin_meta) || 0,
        avance: meta > 0 ? Math.round((1000 * cubierto) / meta) / 10 : 0,
      };
    }
    return avanceEnRespuestas(filas);
  }, [filas, resumen]);

  if (!a.meta) {
    return (
      // El vacío dentro de `.mon-profile-table-wrap` y no como `p` suelto, por
      // la misma razón medida en `AulasAvanceCuota`: las reglas del perfil que
      // matan el margen del `p` y ciñen el panel cuelgan del wrap, y el wrap
      // exento (`owned` + member) saca al head del fallback de miembros.
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          {a.sinMeta
            ? `Ninguno de los ${fmt(a.sinMeta)} cursos-horario del plan declara cuántas respuestas espera.`
            : "El plan todavía no declara metas por curso-horario."}
        </p>
      </div>
    );
  }

  // El excedente se dibuja PEGADO al final de la barra y fuera de la meta: no
  // cabe dentro porque no cubre nada, y ponerlo aparte lo convertiría en una
  // nota que nadie relaciona con la barra.
  const anchoCubierto = Math.round((100 * a.cubierto) / a.meta);
  const anchoExcedente = a.excedente ? Math.max(2, Math.round((100 * a.excedente) / a.meta)) : 0;

  return (
    <div className="aulas-avance-respuestas">
      <p className="aulas-avance-titular">
        {/* `fmt` y no `fmtCuenta`: los dos números ya son enteros por
            construcción —el cálculo local por aula, el resumen del motor en la
            frontera de arriba— y un techo aquí volvería a declarar cubierta una
            respuesta que no existe (1 306,3 pintado «1 307», contradiciendo al
            «1 306 cubren meta» de dos líneas más abajo). */}
        <strong>{fmt(a.cubierto)}</strong> de <strong>{fmt(a.meta)}</strong> respuestas que pide
        el plan · <span className="aulas-avance-pct">{a.avance}%</span>
      </p>
      {/* El hueco entre lo recogido y lo atribuido, DICHO. Hay estudios donde
          llegan miles de respuestas y ninguna se puede colgar de un aula
          —vienen anónimas, sin el enlace que las ata a su curso-horario— y esta
          pantalla enseñaba «3 700 válidas» arriba y «0 de 3 743» aquí, sin nada
          en medio. Se lee como una avería y no lo es: es una propiedad de la
          fuente, y el panel la sabe. */}
      {validasTotales > 0 && a.validas === 0 ? (
        <p className="aulas-avance-sin-atribuir">
          Las <strong>{fmt(validasTotales)}</strong> respuestas del corte llegan sin identificar
          su curso-horario, así que ninguna cuenta para la meta de un curso-horario.
        </p>
      ) : null}
      <div className="aulas-avance-carril" role="img" aria-label={`${a.avance}% de la meta cubierta`}>
        <span className="aulas-avance-meta">
          <i style={{ width: `${anchoCubierto}%`, background: COLOR_RESULTADO.efectiva }} />
          <i style={{ width: `${100 - anchoCubierto}%`, background: COLOR_RESULTADO.pendiente }} />
        </span>
        {anchoExcedente ? (
          <span className="aulas-avance-excedente" style={{ width: `${anchoExcedente}%` }} />
        ) : null}
      </div>
      <ul className="aulas-avance-mermas" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {/* **Las tres etiquetas dicen su unidad.** «57 cubren meta» y «142
            faltan» se leían como cursos-horario en un panel que se llamaba
            «Cumplimiento aula por aula»: son RESPUESTAS, y el número de
            cursos-horario aparece sólo como reparto de las que faltan. */}
        <li className="es-cubierto">
          <strong>{fmt(a.cubierto)}</strong> respuestas cuentan para la meta de su curso-horario
        </li>
        <li className="es-falta">
          {/* Concuerda con el número QUE SE MUESTRA, no con `a.falta`:
              `fmtCuenta` redondea hacia arriba, así que 0,4 se pinta «1» y el
              verbo tiene que seguir a lo pintado. */}
          <strong>{fmtCuenta(a.falta)}</strong>{" "}
          {fmtCuenta(a.falta) === "1" ? "falta" : "faltan"} por recoger, repartidas en{" "}
          {fmt(a.aulasConBrecha)} {a.aulasConBrecha === 1 ? "curso-horario" : "cursos-horario"}
        </li>
        {a.excedente ? (
          <li className="es-excedente">
            {/* La frase entera: sin ella, «excedente» se lee como logro. */}
            <strong>{fmt(a.excedente)}</strong> se recogieron de más en cursos-horario que ya
            habían llegado a su meta; no cubren lo que falta en los otros
          </li>
        ) : null}
        {/* **El puente entre esta cuenta y el KPI de arriba.**
            La banda dice «VÁLIDAS 2,220» y este panel «2,163 cubren meta»: 57
            de diferencia a dos centimetros, sin nada que las una. No es un
            error de suma —el motor cuenta aqui SOLO el eslabon en juego de cada
            cadena, porque contar el titular caido y su reserva juntos inflaria
            una meta dimensionada para un aula— pero callarlo deja dos cifras
            del mismo hecho contradiciendose en la misma pantalla. */}
        {validasTotales > a.validas ? (
          <li className="es-sin-meta">
            <strong>{fmt(validasTotales - a.validas)}</strong> se recogieron en eslabones que ya
            no son el que cuenta en su cadena, así que no suman a ninguna meta
          </li>
        ) : null}
        {a.sinMeta ? (
          <li className="es-sin-meta">
            {fmt(a.sinMeta)} {a.sinMeta === 1 ? "curso-horario no declara" : "cursos-horario no declaran"} su
            meta y quedan fuera de esta cuenta
          </li>
        ) : null}
      </ul>
    </div>
  );
}
