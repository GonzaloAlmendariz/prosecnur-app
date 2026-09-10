import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { tintaSobre } from "../../coloresDeResultado";
import { TRAMOS_DE_APLICACION, clavesDelTramo, estadoDeAplicacion } from "./estadoDeAplicacion";
import { fmt } from "./kpisDeAulas";
import "./aulasEstadoChart.css";

/**
 * El STATUS DE APLICACIÓN en una barra: cuántas cumplen y cuántas ni se han tocado.
 *
 * Va antes que la cobertura porque contesta la pregunta anterior. La cobertura
 * dice cuánto lleva recogido cada aula; ésta dice **cuántas aulas hay en cada
 * punto del circuito**, y sobre todo separa «sin agendar» de «agendada y aún sin
 * empezar», que la cobertura mete en el mismo saco.
 */
type TramoContado = { clave: string; aulas: number };

/**
 * Las que de verdad tienen que salir a campo: ni dormidas ni de la reserva adicional.
 *
 * **Se cuenta desde el total, no desde los tramos, y ése es el arreglo.**
 * Derivarlo como «lo que no está en `en_reserva`, menos la reserva adicional»
 * descuenta la reserva adicional DOS VECES cuando ésta sí cae en ese tramo.
 * Medido el 2026-08-30 sobre el estudio de 1.424: las 77 de la reserva
 * adicional están las 77 en `sample_status: en_reserva`, así que `vivas`
 * (192) ya las excluía y la resta publicaba **115 en juego** cuando el motor
 * marca `en_juego` en **174** —156 titulares vivos más 18 reservas
 * activadas—. La pantalla decía que había 59 cursos-horario menos en campo de
 * los que hay.
 *
 * Y las 192 tampoco eran la respuesta: incluían los 18 titulares reemplazados,
 * que ya no salen, ADEMÁS de las 18 reservas que los sustituyeron.
 *
 * `dormidas` las cuenta el motor sin la reserva adicional
 * (`sum(!en_juego & !del_banco)`, donde `del_banco` es el nombre que usa el
 * motor R para este mismo concepto), así que `total − dormidas − reserva` da
 * exactamente `sum(en_juego)`: la reserva adicional nunca lleva `en_juego`,
 * medido 174 = 156 titulares + 18 reservas y cero de la reserva adicional. Sin
 * ese dato se cae a la forma anterior, que es la que acertaba cuando el motor
 * clasificaba la reserva adicional como «Sin agendar».
 */
function enJuegoDe(
  estados: ReadonlyArray<TramoContado>,
  reserva?: number,
  total?: number,
  dormidas?: number,
): number {
  if (typeof total === "number" && typeof dormidas === "number") {
    return Math.max(0, total - dormidas - (reserva ?? 0));
  }
  const vivas = estados
    .filter((e) => e.clave !== "en_reserva")
    .reduce((n, e) => n + e.aulas, 0);
  return Math.max(0, vivas - (reserva ?? 0));
}

const acotar = (n: number, techo: number) => Math.min(Math.max(n, 0), techo);

/**
 * Dónde están las que no cuentan como «en juego».
 *
 * Son dos cosas distintas y la frase las metía en una: las ENCADENADAS esperan
 * a que caiga su titular, y la RESERVA ADICIONAL es capacidad sin asignar a
 * nadie. Decir de las 2.423 que «sólo entran si cae su titular» es falso para
 * 1.916 de ellas.
 */
function dondeEstanLasOtras(fuera: number, reserva: number): string {
  const dormidas = Math.max(0, fuera - reserva);
  const enReserva = Math.min(reserva, fuera);
  if (dormidas > 0 && enReserva > 0) {
    return `Las otras ${fmt(dormidas)} esperan en reserva —sólo entran si cae su titular— y ${fmt(enReserva)} están en la reserva adicional.`;
  }
  // **La misma función explicaba el mecanismo en dos ramas y lo nombraba en la
  // tercera.** Las otras dos dicen «sólo entran si cae su titular», que se
  // entiende sin saber nada del diseño; ésta decía «sin asignar a ninguna
  // cadena», y «cadena» sólo se define en la sección Consultas, en el panel
  // «Cadena de reemplazos». Quien lee esto está en Resumen.
  if (enReserva > 0) return `Las otras ${fmt(enReserva)} están en la reserva adicional, sin un titular al que respalden.`;
  return `Las otras ${fmt(dormidas)} esperan en reserva: sólo entran si cae su titular.`;
}

export function AulasEstadoChart({
  filas, resumen, desconocidasMotor, reservaMotor, dormidasMotor, totalDelPlan,
}: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** El reparto del motor, sobre TODAS las filas y no sobre las 500 que viajan. */
  resumen?: ReadonlyArray<{ clave: string; aulas: number }> | null;
  /**
   * Cuántos cursos-horario tiene el plan entero (`course_status_total`), para
   * que el RESPALDO sepa si lo que le llegó es el plan o el recorte. Igual que
   * en `AulasCoberturaChart`: sin el bloque del motor, repartir 500 filas
   * ordenadas por tramo dibuja una forma que no es la del operativo.
   */
  totalDelPlan?: number;
  /** Estados que el motor no supo clasificar: se declaran, no se tragan. */
  desconocidasMotor?: number;
  /**
   * Cuántas de las filas son de la reserva adicional, contadas por el motor
   * sobre TODAS.
   *
   * `enJuego` las descontaba por ESTADO —las de clave `en_reserva`— y eso sólo
   * funciona si el motor marca así la reserva adicional. Medido el 2026-08-23
   * sobre el sorteo del 22: clasificó las 507 reservas encadenadas como
   * `en_reserva` y las 1.916 de la reserva adicional como «Sin agendar», así
   * que el pie decía «2.109 de 2.109 cursos-horario en juego todavía no salen
   * a campo» sobre un operativo de 193 visitas. Diez veces el trabajo que hay.
   *
   * El motor ya lo contaba —`attr(recortado, "banco")`, con `en_juego_cs`
   * excluyendo la reserva adicional explícitamente— y lo emite como
   * `course_status_banco`. Sólo faltaba consumirlo.
   */
  reservaMotor?: number;
  /**
   * Reservas dormidas contadas por el motor SIN la reserva adicional
   * (`sum(!en_juego & !del_banco)`). Es lo que permite contar «en juego» desde
   * el total en vez de derivarlo de los tramos, que es donde se colaba el doble
   * descuento de la reserva adicional.
   */
  dormidasMotor?: number;
}) {
  // Si lo que llegó es el plan entero o el recorte. Sin el dato se asume
  // completo: un payload viejo se comporta como antes.
  const recortado = typeof totalDelPlan === "number" && totalDelPlan > filas.length;
  const { estados, desconocidas, total, sinSalirACampo, enJuego } = useMemo(
    () => {
      // El reparto del MOTOR primero: la vista lo sumaba sobre `course_status`,
      // que viaja recortado a 500 filas de 2 615, y el recorte no es una muestra
      // al azar —el orden pone `en_aplicacion` primero—, así que el gráfico
      // salía sesgado hacia lo avanzado.
      if (resumen?.length) {
        const porClave = new Map(resumen.map((e) => [e.clave, Number(e.aulas) || 0]));
        const estados = TRAMOS_DE_APLICACION.map((t) => ({
          clave: t.clave, etiqueta: t.etiqueta, color: t.color,
          // Un tramo puede recoger varias claves del motor —los aplicados
          // recogen `en_aplicacion` y `cerrando`—, así que se SUMAN. Leer sólo
          // `t.clave` dejaba el tramo fundido en cero sin que nada fallara.
          aulas: clavesDelTramo(t).reduce((n, k) => n + (porClave.get(k) ?? 0), 0),
        }));
        const total = estados.reduce((n, e) => n + e.aulas, 0);
        if (total) {
          return {
            estados, total,
            desconocidas: desconocidasMotor ?? 0,
            // El numerador descuenta la reserva adicional IGUAL que el
            // denominador. Al arreglar sólo el de abajo, la frase quedó en
            // «2.109 de 193», que es la misma mitad-y-mitad de antes con los
            // papeles cambiados: la reserva adicional cae en `pendiente`, así
            // que estaba en los dos lados. Acotado a [0, en juego] porque un
            // desglose incoherente no puede producir un numerador negativo ni
            // mayor que su total.
            // **También hay dormidas fuera del balde `en_reserva`.**
            //
            // Sumaba `pendiente` + `lista` y le quitaba la reserva adicional,
            // pero `pendiente` recoge además las reservas encadenadas con
            // RECHAZO tecleado —4 sobre HSVG26ULT2 el 2026-09-08— que no están
            // en juego y nadie descontaba: la frase decía «152 de 174» donde
            // «Cursos-horario por cobertura», el panel de al lado, dice 148 sin
            // respuestas.
            //
            // Cuántas son se deduce sin adivinar: el motor publica las dormidas
            // (`reservas_dormidas`, 1 173) y el balde que pinta la barra
            // (`en_reserva`, 1 169). La diferencia son las que duermen en otro
            // balde. Un primer intento restó desde arriba —«en juego menos lo
            // que está en campo»— y el test lo cazó: eso metía las REEMPLAZADAS
            // entre las que «no salen a campo», y una reemplazada no espera
            // salir.
            sinSalirACampo: acotar(
              estados
                .filter((e) => e.clave === "pendiente" || e.clave === "lista")
                .reduce((n, e) => n + e.aulas, 0)
                - (reservaMotor ?? 0)
                - Math.max(0, (dormidasMotor ?? 0) - (porClave.get("en_reserva") ?? 0)),
              enJuegoDe(estados, reservaMotor, total, dormidasMotor),
            ),
            // **El denominador de esa frase no es el total.**
            //
            // «5 de 269 cursos-horario todavía no salen a campo» se lee como que
            // los otros 264 sí salieron, y 70 de esos 269 son de la reserva
            // adicional que NO van a salir salvo que caiga su titular. El
            // numerador ya las excluía —sólo suma `pendiente` y `lista`— y el
            // denominador las metía: la mitad de la fracción contaba una cosa
            // y la otra mitad, otra. Las que están en juego son el total menos
            // las dormidas. Menos las dormidas por estado Y menos la reserva
            // adicional, que el motor cuenta aparte porque no siempre cae en
            // `en_reserva`.
            enJuego: enJuegoDe(estados, reservaMotor, total, dormidasMotor),
          };
        }
      }
      // **Sin el bloque del motor, sólo se reparte si llegó el plan ENTERO.**
      // Medido el 2026-09-09: `course_status` viaja con 500 filas de 1 392 y
      // ordenadas por tramo del circuito, así que el respaldo dibujaría un
      // operativo mucho más avanzado del que hay. Un vacío que dice la causa
      // vale más que un gráfico plausible y falso.
      if (recortado) {
        return { estados: [], desconocidas: 0, total: 0, sinSalirACampo: 0, enJuego: 0 };
      }
      const propio = estadoDeAplicacion(filas);
      return {
        ...propio,
        enJuego: propio.estados
          .filter((e) => e.clave !== "en_reserva")
          .reduce((n, e) => n + e.aulas, 0),
      };
    },
    [filas, resumen, desconocidasMotor, reservaMotor, dormidasMotor, recortado],
  );

  if (!total) {
    return (
      // La anatomía del vacío del perfil (precedente en `AulasAvanceCuota`):
      // el wrap exento declara su capacidad y sus reglas ciñen el `p`.
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          {recortado
            ? `El reparto por estado no llegó con los datos y aquí sólo hay ${fmt(filas.length)} de los ${fmt(totalDelPlan ?? 0)} cursos-horario del plan: repartir ese recorte dibujaría un operativo más avanzado del que hay. Recarga para volver a pedirlo.`
            : "Todavía no hay cursos-horario en el plan."}
        </p>
      </div>
    );
  }

  // Loop mejora-ui E9/E21: el swatch de una categoría en cero se apaga hacia
  // el fondo — el cero se declara en el texto y el color pleno junto a un
  // cero prometía un segmento que la barra no tiene.
  const swatchApagado = (hex: string): string => {
    const n = hex.replace("#", "");
    const c = (i: number) => Math.round(parseInt(n.slice(i, i + 2), 16) * 0.3 + 255 * 0.7);
    return `rgb(${c(0)}, ${c(2)}, ${c(4)})`;
  };

  // E21 — **barras CSS y no Plotly**, con el criterio sentado por el dictado
  // del chart de sexo (2026-09-03): pregunta declarada en la cabecera del
  // panel, leyenda que informa sin filtrar, cero interactividad fantasma
  // (el Plotly ofrecía crosshair, drag muerto y leyenda-toggle), y el
  // precedente del embudo para el motor de dibujo. La semántica no cambia:
  // mismos tramos, mismos colores, la cifra DENTRO del segmento con la tinta
  // que contrasta, y el separador blanco entre segmentos contiguos.
  const detalle = estados
    .map((e) => `${e.etiqueta} ${fmt(e.aulas)}`)
    .join(" · ");

  return (
    // C1: quién posee el espacio interior del panel. Sin declararlo, el gate
    // cae a la cabecera como dueña y reporta sus 4-5 px de holgura como
    // `capacity-drift`, que es un diagnóstico sobre el sitio equivocado.
    <div className="aulas-estado-chart aulas-estado-css" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <ul className="aulas-estado-leyenda" aria-hidden="true">
        {estados.map((e) => (
          <li key={e.clave} className={e.aulas ? undefined : "es-cero"}>
            <i style={{ background: e.aulas ? e.color : swatchApagado(e.color) }} />
            {e.etiqueta} {fmt(e.aulas)}
          </li>
        ))}
      </ul>
      <div
        className="aulas-estado-pista"
        role="img"
        aria-label={`Cursos-horario por estado de aplicación: ${detalle}`}
      >
        {estados.filter((e) => e.aulas > 0).map((e) => {
          const ancho = (100 * e.aulas) / total;
          return (
            <i
              key={e.clave}
              style={{ width: `${ancho}%`, background: e.color, color: tintaSobre(e.color) }}
              title={`${e.etiqueta}: ${fmt(e.aulas)} de ${fmt(total)}`}
            >
              {/* La cifra solo si cabe: en un segmento angosto se volvería
                  ruido encimado; su valor sigue en la leyenda y el title. */}
              {ancho >= 5 ? fmt(e.aulas) : ""}
            </i>
          );
        })}
      </div>
      <p className="mon-profile-table-recorte">
        {sinSalirACampo
          // El pie de ESTE gráfico habla de su propio eje. Decía «no han
          // recibido ni una respuesta» y contaba agendamiento: 14 aquí contra
          // los 48 que el panel de cobertura mostraba un dedo más abajo.
          ? `${fmt(sinSalirACampo)} de ${fmt(enJuego)} cursos-horario en juego todavía no salen a campo.`
          : `Los ${fmt(enJuego)} cursos-horario en juego ya salieron.`}
        {/* Y las dormidas se nombran en vez de desaparecer de la frase: si el
            lector ve 269 en la cabecera y 199 aquí, la diferencia tiene que
            estar dicha.

            «en reserva» y NO «en la reserva adicional»: son dos conjuntos
            distintos y la frase llamaba «banco» al que no lo era. Medido el
            2026-08-23 sobre el sorteo del 22, las dos frases convivían en la
            misma pantalla —«las otras 507 son reservas que esperan en el
            banco» y «1.916 son reservas del banco»—, con la misma palabra
            para 507 y para 1.916. Las 507 están ENCADENADAS a un titular
            concreto; la reserva adicional es capacidad sin asignar. */}
        {/* **Se intentó tomar las dormidas del balde `en_reserva` que pinta la
            barra** —porque ésta dice «En reserva 1 169» y la frase «las otras
            1 173»— y el test lo tumbó con razón: cuando la reserva adicional va
            DENTRO de ese balde (el caso real de 1 424 filas con 77 adicionales),
            el balde vale 1 250 y la frase habría dicho 1 250 en vez de 1 173,
            contando la adicional dos veces.
            Las 4 de diferencia de hoy son reservas dormidas con RECHAZO
            tecleado: están dormidas —cuentan— aunque su titular ya no vaya a
            liberarlas. */}
        {total > enJuego ? ` ${dondeEstanLasOtras(total - enJuego, reservaMotor ?? 0)}` : ""}
        {/* Un estado que el motor no declare se dice, no se descarta: es el
            mismo patrón de lista cerrada que ya costó doce ítems. */}
        {desconocidas
          ? ` ${desconocidas} en un estado que esta vista no reconoce.`
          : ""}
      </p>
    </div>
  );
}
