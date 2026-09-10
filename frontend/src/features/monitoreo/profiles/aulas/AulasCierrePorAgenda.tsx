import type { ReactNode } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { cierrePorAgenda } from "./cierrePorAgenda";
import { etiquetaDeFecha } from "./agendaPorDia";
import { ejeDeDias } from "./ejeDeDias";
import { fmt } from "./kpisDeAulas";
import "./aulasCierrePorAgenda.css";

/**
 * Hasta dónde llega lo AGENDADO, día a día.
 *
 * Sustituye al pronóstico lineal, que extrapolaba «al ritmo observado de N
 * cursos-horario por día». Gonzalo, tres veces sobre lo mismo:
 *
 * > «El pronóstico no es lineal: no depende de que si hoy aplicamos treinta,
 * > mañana treinta. Depende del RITMO DE LA AGENDA… no entender la agendación ni
 * > las metas como cosas lineales, sino cosas que dependen de las aulas que se
 * > hayan agendado y de los esperables que esperamos allí, contrastando siempre
 * > que tenemos un rendimiento diferenciado entre el rendimiento planificado y
 * > el que vamos encontrando.»
 *
 * La velocidad deja de ser una propiedad del equipo y pasa a serlo de la agenda:
 * un lunes con ocho cursos-horario y un martes con dos dejan de ser el mismo
 * día. El cálculo vive en `cierrePorAgenda.ts`; aquí sólo se dibuja.
 *
 * **Dos curvas, no una.** Lo que el diseño espera de esas aulas y lo que su
 * facultad está sacando de verdad. Es el contraste que él pide —«el rendimiento
 * planificado contra el que vamos encontrando»— y en una sola curva no existe.
 *
 * **Y lo que este gráfico NO puede decir se declara**: cuándo cierra el plan
 * entero. Sólo llega hasta donde llega la agenda; las aulas sin fecha no tienen
 * cuándo, y ponerles uno inventado sería la extrapolación por otra puerta.
 */

/** Alto del área de dibujo, en px. Cabe al lado de sus vecinos de Resumen. */
const ALTO = 132;
/** El mes en tres letras, bajo el día, sólo cuando cambia. */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

export function AulasCierrePorAgenda({ plan, meta, corte = "", desde = "" }: {
  plan: ReadonlyArray<MonitoreoRow> | null | undefined;
  /** La cuota contra la que se mide si la agenda alcanza. `null` si no viaja. */
  meta?: number | null;
  /** El día del corte, para no contar como futuro lo que ya pasó. */
  corte?: string;
  /**
   * El primer día del eje: la primera jornada de aplicación.
   *
   * Con él, este gráfico y el ritmo de arriba comparten calendario —«los dos
   * gráficos temporales tienen que alinearse»— y el eje empieza donde empezó el
   * operativo, no donde empieza la agenda pendiente. Sin él, el eje arranca en
   * el primer día agendado, que es lo que hacía antes.
   */
  desde?: string;
}): ReactNode {
  const c = cierrePorAgenda(plan, corte);

  if (!c.dias.length) {
    return (
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          {c.motivo === "sin-plan"
            ? "El plan todavía no trae cursos-horario que proyectar."
            : `No hay ningún curso-horario agendado sin aplicar, así que no hay agenda que proyectar${
              c.sinAgendar ? `: ${fmt(c.sinAgendar)} esperan fecha` : ""}.`}
        </p>
      </div>
    );
  }

  const metaN = meta == null || !Number.isFinite(Number(meta)) ? null : Math.round(Number(meta));

  /**
   * **El eje son TODOS los días, no sólo los que tienen agenda.**
   *
   * Gonzalo: «todos los días deberían estar allí desde el primer día de
   * aplicación hasta el último día agendado». El eje anterior era de posición
   * —un punto por día CON algo agendado—, así que un salto de cinco días entre
   * dos citas se dibujaba igual que uno de un día: la curva mentía sobre el
   * tiempo. Con el calendario completo, la pendiente vuelve a significar
   * velocidad.
   *
   * El acumulado se arrastra en los días sin cita, que es lo que de verdad pasa:
   * ese día no entra nada.
   */
  const eje = ejeDeDias(desde || c.dias[0].fecha, c.ultimaFecha, corte);
  const porFecha = new Map(c.dias.map((d) => [d.fecha, d]));
  let arrastrePlan = c.conseguidas;
  let arrastreObs = c.conseguidas;
  const dias = (eje.length ? eje : c.dias.map((d) => ({ fecha: d.fecha, esDeCampo: true, pasado: false })))
    .map((d) => {
      const dato = porFecha.get(d.fecha);
      if (dato) {
        arrastrePlan = dato.acumuladoPlan;
        arrastreObs = dato.acumuladoObservado;
      }
      return { fecha: d.fecha, acumuladoPlan: arrastrePlan, acumuladoObservado: arrastreObs };
    });

  const ultimo = dias[dias.length - 1];
  // El techo del eje incluye la meta: si la agenda no llega, el hueco tiene que
  // verse — que es justo la lectura que este panel existe para dar.
  const techo = Math.max(ultimo.acumuladoPlan, ultimo.acumuladoObservado, metaN ?? 0, 1);
  const x = (i: number) => (dias.length === 1 ? 100 : (100 * i) / (dias.length - 1));
  const y = (v: number) => ALTO - (ALTO * Math.min(v, techo)) / techo;
  const linea = (campo: "acumuladoPlan" | "acumuladoObservado") =>
    dias.map((d, i) => `${x(i)},${y(d[campo])}`).join(" ");

  const alcanzaPlan = metaN != null && ultimo.acumuladoPlan >= metaN;
  const alcanzaObs = metaN != null && ultimo.acumuladoObservado >= metaN;

  return (
    <div className="aulas-cpa" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-cpa-lectura">
        {/* La frase antes que el dibujo: es la respuesta, y el gráfico la
            sostiene. Sin ella hay que deducirla mirando dónde cruza una curva. */}
        Con lo agendado hasta el {etiquetaDeFecha(c.ultimaFecha)} se llegaría a{" "}
        <strong>{fmt(Math.round(ultimo.acumuladoObservado))}</strong> respuestas
        {metaN != null ? (
          alcanzaObs
            ? <> · la meta de {fmt(metaN)} <em className="es-sobra">se cubre</em></>
            : <> · faltarían <em className="es-corto">{fmt(metaN - Math.round(ultimo.acumuladoObservado))}</em> para la meta de {fmt(metaN)}</>
        ) : null}
      </p>

      <div className="aulas-cpa-marco">
        <svg viewBox={`0 0 100 ${ALTO}`} preserveAspectRatio="none" role="img"
          aria-label={[
            `Acumulado proyectado desde la agenda hasta el ${etiquetaDeFecha(c.ultimaFecha)}:`,
            `${fmt(Math.round(ultimo.acumuladoObservado))} respuestas al rendimiento observado`,
            `y ${fmt(Math.round(ultimo.acumuladoPlan))} al del diseño`,
          ].join(" ")}>
          {/* La meta, si la hay: la vara horizontal contra la que se lee todo. */}
          {metaN != null && metaN <= techo ? (
            <line className="aulas-cpa-meta" x1="0" x2="100" y1={y(metaN)} y2={y(metaN)} />
          ) : null}
          <polyline className="aulas-cpa-plan" points={linea("acumuladoPlan")} />
          <polyline className="aulas-cpa-observado" points={linea("acumuladoObservado")} />

        </svg>
        {/* Los rótulos van FUERA del SVG: dentro, con `preserveAspectRatio` en
            «none», el texto se estira con el ancho del panel. */}
        {/* Redondeado: el techo sale de un acumulado con decimales —la
            corrección por rendimiento no da enteros— y el rótulo decía
            «2.850,1». Media respuesta no existe, y es la misma regla que ya
            gobierna el resto del perfil. */}
        {/* **El techo se calla cuando la meta le pisa el sitio.** Con 2 850 de
            techo y una meta de 2 500 los dos rótulos caen a dieciséis píxeles y
            se leían encima. Manda la meta: es la referencia contra la que se
            juzga la curva; el techo sólo dice hasta dónde llega la escala. */}
        {/* **El punto del final va en HTML, no en el SVG.** Con
            `preserveAspectRatio="none"` el `viewBox` de 100 unidades se estira a
            mil y pico píxeles, así que un `<circle>` se pinta como elipse
            —`vector-effect` sólo corrige el TRAZO, no la forma—. Fuera del SVG
            es redondo a cualquier ancho. */}
        <span
          className="aulas-cpa-fin"
          style={{ left: "100%", top: `${(100 * y(ultimo.acumuladoObservado)) / ALTO}%` }}
        />
        {metaN == null || (techo - metaN) / techo > 0.18 ? (
          <span className="aulas-cpa-techo">{fmt(Math.round(techo))}</span>
        ) : null}
        {metaN != null && metaN <= techo ? (
          <span className="aulas-cpa-rotulo-meta" style={{ top: `${(100 * y(metaN)) / ALTO}%` }}>
            meta {fmt(metaN)}
          </span>
        ) : null}
      </div>

      {/* **El eje de días, con días.** Gonzalo: «a ninguno de los dos se le ven
          bien los días, están salteados, y en el segundo gráfico directamente ni
          se ven los días». Tenía dos fechas en los extremos y nada en medio: una
          curva que cubre tres semanas sin marcas intermedias no se puede leer —no
          se sabe si la subida es de esta semana o de la que viene—.

          Los rótulos se reparten sobre los días QUE EXISTEN en la agenda, no
          sobre una malla de calendario: el eje del gráfico es de posición, y un
          rótulo en una posición sin dato apuntaría a un sitio donde la curva no
          tiene punto. */}
      {/* **Todos los días, con su número, y el mes sólo donde cambia.** Misma
          regla que el ritmo de arriba, para que los dos ejes se lean igual. */}
      <div className="aulas-cpa-eje">
        {dias.map((d, i) => (
          <span key={d.fecha} style={{ left: `${x(i)}%` }}>
            <i />
            {d.fecha.slice(8, 10)}
            {i === 0 || d.fecha.slice(5, 7) !== dias[i - 1].fecha.slice(5, 7) ? (
              <b>{MESES[Number(d.fecha.slice(5, 7)) - 1]}</b>
            ) : null}
          </span>
        ))}
      </div>

      <ul className="aulas-cpa-claves">
        <li>
          <i className="es-observado" />
          <span>
            <strong>{fmt(Math.round(ultimo.acumuladoObservado))}</strong>{" "}
            <em>al rendimiento que está dando cada facultad</em>
          </span>
        </li>
        <li>
          <i className="es-plan" />
          <span>
            <strong>{fmt(Math.round(ultimo.acumuladoPlan))}</strong>{" "}
            <em>al que el diseño les supuso{alcanzaPlan === alcanzaObs ? "" : alcanzaPlan ? ": aquí sí llegaba" : ": aquí tampoco llegaba"}</em>
          </span>
        </li>
      </ul>

      <p className="aulas-cpa-pie">
        {/* **Lo que el modelo no puede decir.** Un pronóstico que calla las
            aulas sin fecha promete un cierre que no depende de él. */}
        Sale de los {fmt(c.dias.reduce((n, d) => n + d.cursos, 0))} cursos-horario que ya tienen
        fecha y aún no se aplican, cada uno el día que le toca.
        {c.sinAgendar ? (
          <> Quedan <strong>{fmt(c.sinAgendar)}</strong> sin fecha
          {c.esperadasSinAgendar ? <> —unas {fmt(Math.round(c.esperadasSinAgendar))} respuestas más—</> : null}
          : hasta que se agenden, el plan no puede cerrar y esta curva no los cuenta.</>
        ) : null}
      </p>
    </div>
  );
}
