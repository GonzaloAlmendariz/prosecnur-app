import type { ReactNode } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { agendacionDeAulas } from "./agendacionDeAulas";
import { etiquetaDeFecha } from "./agendaPorDia";
import { ejeDeDias } from "./ejeDeDias";
import { fmt } from "./kpisDeAulas";
import { mesCortoDe } from "../../mesesEnPalabras";
import "./aulasAgendacion.css";

/**
 * Cómo va la agendación: el trabajo que decide a qué aulas se va a ir.
 *
 * Gonzalo: «es muy importante tener en Resumen cómo va la agendación de aulas,
 * porque es lo que nos permite decir a estas aulas vamos a ir a aplicar, y eso
 * está en el Sheets».
 *
 * **No repite «Estado de aplicación».** Aquel reparte los titulares por su punto
 * del circuito y contesta dónde está cada uno hoy; éste contesta si el trabajo
 * de agendar va a un ritmo que alcance, que es una pregunta sobre el equipo y no
 * sobre las aulas.
 *
 * **Tres trabajos, no uno.** Él lo separó al ver la primera versión: «falta
 * tomar en cuenta agendación que son reemplazos, agendaciones de titulares, y
 * cuántos en contacto se tiene que aún no recibimos respuesta». Agendar un
 * titular, insistirle a quien no contesta y activar una reserva son tres cosas
 * distintas y las hace gente distinta; el panel las nombra por separado.
 *
 * **No proyecta.** Él descartó el pronóstico lineal para las aplicaciones y aquí
 * valdría igual: se publican los días medidos y lo que queda, y la cuenta la
 * hace quien lee, que sabe cuántos días de campo le quedan.
 */
export function AulasAgendacion({ agenda, corte = "" }: {
  agenda: ReadonlyArray<MonitoreoRow> | null | undefined;
  /**
   * El último día del estudio. El eje llega hasta aquí aunque hoy no se haya
   * agendado nada: un día en blanco al final es justo lo que hay que ver.
   */
  corte?: string;
}): ReactNode {
  const a = agendacionDeAulas(agenda);

  if (!a.titulares) {
    return (
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          El plan todavía no trae cursos-horario titulares que agendar.
        </p>
      </div>
    );
  }

  /**
   * **Todos los días del calendario, no sólo los que tuvieron agendación.**
   *
   * Gonzalo, del eje de los otros dos gráficos: «todos los días deberían estar
   * allí desde el primer día hasta el último». Un eje que salta el sábado y el
   * domingo dibuja un ritmo que no existió —dos columnas seguidas parecen dos
   * días seguidos— y esconde justo los días en los que no se agendó nada.
   *
   * El eje lo arma `ejeDeDias`, que es de donde salen también los dos gráficos
   * temporales de esta misma pestaña; una segunda fórmula de rango ya se
   * desincronizó una vez en este perfil.
   */
  const primero = a.porDia[0]?.fecha ?? "";
  const ultimo = a.porDia[a.porDia.length - 1]?.fecha ?? "";
  const finDelEje = corte && corte > ultimo ? corte : ultimo;
  const eje = primero ? ejeDeDias(primero, finDelEje, corte) : [];
  const conteos = new Map(a.porDia.map((d) => [d.fecha, d]));
  const dias = eje.map((d) => ({
    ...d,
    titulares: conteos.get(d.fecha)?.titulares ?? 0,
    reemplazos: conteos.get(d.fecha)?.reemplazos ?? 0,
    aulas: conteos.get(d.fecha)?.aulas ?? 0,
  }));
  const tope = dias.reduce((m, d) => Math.max(m, d.aulas), 0);
  const alto = (n: number) => (tope ? `${(100 * n) / tope}%` : "0%");

  return (
    <div className="aulas-agd" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-agd-lectura">
        <strong>{fmt(a.reparto.conFecha)}</strong> de {fmt(a.reparto.total)} titulares
        {" "}ya tienen fecha
        {a.reparto.enContacto ? (
          <> · <strong>{fmt(a.reparto.enContacto)}</strong> en contacto sin respuesta todavía</>
        ) : null}
        {a.reparto.sinContactar ? (
          <> · <strong>{fmt(a.reparto.sinContactar)}</strong> sin contactar aún</>
        ) : null}
        {a.reparto.rechazos ? (
          <> · <strong>{fmt(a.reparto.rechazos)}</strong> {a.reparto.rechazos === 1 ? "rechazó" : "rechazaron"}</>
        ) : null}
        {a.hasta ? <> · lo agendado llega hasta el {etiquetaDeFecha(a.hasta)}</> : null}
      </p>

      {a.porDia.length ? (
        <>
          {/* **Barras por día de AGENDACIÓN**, que es cuándo se habló con el
              docente y no cuándo se va al aula. En el corte del 2026-09-10 la
              forma habla sola: 29, 34 y 50 la semana antes del campo, y 4, 13 y
              19 desde que empezó — agendar y aplicar compiten por la misma
              gente. */}
          {/* **Una rejilla de tres filas, no una columna flex por día.**
              Gonzalo, con la captura delante: «este debe estar alineado y más
              estético y robusto». La causa del desalineamiento era el MES: iba
              como un hijo más de la columna, así que la que lo llevaba —sólo la
              primera y los cambios de mes— empujaba su día una línea arriba y
              el resto de la fila quedaba a otra altura. Con filas de alto fijo
              la fila del mes existe siempre, vacía o no, y todo cae en su
              renglón. */}
          <ul className={`aulas-agd-dias${dias.length > 22 ? " es-apretado" : ""}`} role="img"
            aria-label={`Cursos-horario agendados por día: ${dias.map((d) => `${d.etiqueta}: ${d.aulas}`).join(", ")}`}>
            {dias.map((d, i) => {
              const porcentaje = tope ? (100 * d.aulas) / tope : 0;
              // Con la barra casi llena la cifra no cabe encima y se saldría del
              // carril: entra dentro, en blanco sobre el relleno. El umbral sale
              // de la cuenta, no del ojo: el carril mide 96 px y la cifra con su
              // aire ocupa 14, así que encima cabe hasta el 85 %.
              const dentro = porcentaje > 85;
              const cambiaDeMes = i === 0 || d.fecha.slice(5, 7) !== dias[i - 1].fecha.slice(5, 7);
              return (
                <li key={d.fecha} className={d.aulas ? "" : "es-sin-agendar"}>
                  <span className="aulas-agd-barra">
                    {/* Apiladas: la reserva activada va encima del titular, con
                        su propio tono, porque es otro trabajo. */}
                    <i style={{ height: `${porcentaje}%` }}>
                      {d.reemplazos ? (
                        <b style={{ height: `${(100 * d.reemplazos) / (d.aulas || 1)}%` }} />
                      ) : null}
                    </i>
                    {/* **La cifra ENCIMA de su barra, no en una fila aparte.**
                        Suelta arriba, «29» quedaba a media pantalla de la barra
                        que cuenta y había que emparejarlas a ojo. Es lo mismo
                        que él pidió para las barras de metas: «mostrar los
                        porcentajes de cada barra en su parte superior». */}
                    {d.aulas ? (
                      <span
                        className={`aulas-agd-n${dentro ? " es-dentro" : ""}`}
                        style={{ bottom: `${porcentaje}%` }}
                      >
                        {fmt(d.aulas)}
                      </span>
                    ) : null}
                  </span>
                  {/* La fecha, clara: «si es una barra de agendación diaria el
                      día o fecha deben estar claros». El mes se escribe al
                      empezar y cada vez que cambia —repetirlo en las veinte
                      columnas es la misma ceguera que no ponerlo—. */}
                  <span className="aulas-agd-dia">{d.fecha.slice(8, 10)}</span>
                  <span className="aulas-agd-mes">{cambiaDeMes ? mesCortoDe(d.fecha) : ""}</span>
                </li>
              );
            })}
          </ul>
          <p className="aulas-agd-pie">
            cursos-horario a los que se les puso fecha cada día
            {a.reemplazos.total ? (
              <> · <span className="aulas-agd-clave es-titular" /> titulares{" "}
              <span className="aulas-agd-clave es-reemplazo" /> reemplazos</>
            ) : null}
            {a.sinDiaDeContacto ? (
              <> · {fmt(a.sinDiaDeContacto)} agendados no traen fecha de contacto y no salen aquí</>
            ) : null}
          </p>
        </>
      ) : null}

      {a.reemplazos.total ? (
        <p className="aulas-agd-pie">
          {/* **Cuántos y DE QUÉ TIPO.** Gonzalo: «tampoco me estás diciendo
              cuántos reemplazos ya se aplicaron y qué tipo de reemplazos». El
              tipo es el nivel de equivalencia que escribe el sorteo, y dice
              cuánto se parece la reserva al titular que releva: de eso depende
              que la celda se conserve o se degrade. */}
          {/* «Reservas activadas» y no «reemplazos en juego»: el reparto por rol
              que va justo debajo llama «Utilizados» a los que ya tienen fecha, y
              dos nombres para lo mismo en el mismo panel es la avería más cara
              de este perfil. Aquí se cuentan también los que están en contacto,
              y la frase lo dice en vez de dejar dos cifras enfrentadas. */}
          Reservas activadas: <strong>{fmt(a.reemplazos.total)}</strong>
          {" — "}
          {a.activados.aplicados
            ? <><strong>{fmt(a.activados.aplicados)}</strong> ya aplicados</>
            : <>ninguno aplicado todavía</>}
          {a.reemplazos.conFecha ? <> · <strong>{fmt(a.reemplazos.conFecha)}</strong> con fecha</> : null}
          {a.reemplazos.enContacto ? <> · <strong>{fmt(a.reemplazos.enContacto)}</strong> en contacto</> : null}
          {a.reemplazos.sinContactar ? <> · <strong>{fmt(a.reemplazos.sinContactar)}</strong> sin contactar</> : null}
          {a.activados.porEquivalencia.length ? (
            <>
              {". "}
              {a.activados.porEquivalencia.map((e, i) => (
                <span key={e.nivel}>
                  {i ? " · " : ""}<strong>{fmt(e.aulas)}</strong> {e.palabras}
                </span>
              ))}
            </>
          ) : null}
          {a.activados.cubren.length ? (
            <> · cubren {a.activados.cubren.slice(0, 6).join(", ")}
              {a.activados.cubren.length > 6 ? ` y ${fmt(a.activados.cubren.length - 6)} más` : ""}</>
          ) : null}
          {/* **El motivo no viene, y se dice.** `replacement_reason` va vacío en
              los cuatro relevos del corte: el porqué está en la nota de campo,
              en prosa. Callarlo dejaría que dentro de un mes nadie sepa por qué
              se activó esta reserva y no otra. */}
          {a.activados.sinMotivo ? (
            <> · <strong>{fmt(a.activados.sinMotivo)}</strong> sin motivo declarado en el libro</>
          ) : null}
        </p>
      ) : null}

      {a.faltanPorFacultad.length ? (
        <p className="aulas-agd-faltan">
          {/* A quién le falta, con nombre: «29 sin fecha» no dice a quién llamar. */}
          Sin fecha:{" "}
          {a.faltanPorFacultad.slice(0, 6).map((f, i) => (
            <span key={f.facultad}>
              {i ? " · " : ""}<strong>{fmt(f.aulas)}</strong> {f.facultad}
            </span>
          ))}
          {a.faltanPorFacultad.length > 6 ? (
            <> · y {fmt(a.faltanPorFacultad.length - 6)} facultades más</>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
