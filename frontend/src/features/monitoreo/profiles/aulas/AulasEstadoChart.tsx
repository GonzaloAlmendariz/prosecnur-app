import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { fuenteDeCifraEnBarra, fuenteDeEjeAulas } from "./ejesDeAulas";
import { COLOR_SEPARADOR_BARRA, tintaSobre } from "../../coloresDeResultado";
import { TRAMOS_DE_APLICACION, estadoDeAplicacion } from "./estadoDeAplicacion";
import { fmt } from "./kpisDeAulas";

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

export function AulasEstadoChart({ filas, resumen, desconocidasMotor, reservaMotor, dormidasMotor }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** El reparto del motor, sobre TODAS las filas y no sobre las 500 que viajan. */
  resumen?: ReadonlyArray<{ clave: string; aulas: number }> | null;
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
          aulas: porClave.get(t.clave) ?? 0,
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
            sinSalirACampo: acotar(
              estados
                .filter((e) => e.clave === "pendiente" || e.clave === "lista")
                .reduce((n, e) => n + e.aulas, 0) - (reservaMotor ?? 0),
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
      const propio = estadoDeAplicacion(filas);
      return {
        ...propio,
        enJuego: propio.estados
          .filter((e) => e.clave !== "en_reserva")
          .reduce((n, e) => n + e.aulas, 0),
      };
    },
    [filas, resumen, desconocidasMotor, reservaMotor],
  );

  if (!total) {
    return (
      // La anatomía del vacío del perfil (precedente en `AulasAvanceCuota`):
      // el wrap exento declara su capacidad y sus reglas ciñen el `p`.
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">Todavía no hay cursos-horario en el plan.</p>
      </div>
    );
  }

  // Loop mejora-ui E9: el swatch de una categoría en cero se apaga hacia el
  // fondo. La leyenda ya declara el cero en el texto («En cierre 0»), pero el
  // cuadrito a color pleno junto a ese cero prometía un segmento que la barra
  // no tiene — seis swatches al mismo volumen para tres segmentos reales. El
  // color apagado solo vive en la leyenda: una traza en cero no pinta barra.
  const swatchApagado = (hex: string): string => {
    const n = hex.replace("#", "");
    const c = (i: number) => Math.round(parseInt(n.slice(i, i + 2), 16) * 0.3 + 255 * 0.7);
    return `rgb(${c(0)}, ${c(2)}, ${c(4)})`;
  };

  const data = estados.map((estado) => ({
    type: "bar",
    orientation: "h",
    // **El conteo va EN la leyenda.** El gráfico crea una traza por estado,
    // incluidos los que valen cero, así que la leyenda listaba seis entradas
    // sobre una barra con tres segmentos y no había forma de saber cuáles
    // estaban en cero sin pasar el cursor. Un cero declarado sólo cuenta como
    // declarado si se lee: «Agendada 0» dice lo que «Agendada» junto a una
    // barra que no aparece deja adivinar.
    name: `${estado.etiqueta} ${fmt(estado.aulas)}`,
    y: ["Cursos-horario"],
    x: [estado.aulas],
    marker: {
      color: estado.aulas ? estado.color : swatchApagado(estado.color),
      // El trazo blanco es lo que deja ver la frontera entre dos segmentos
      // contiguos cuando uno de ellos es muy corto.
      line: { color: COLOR_SEPARADOR_BARRA, width: 1 },
    },
    // La etiqueta de la barra pasa por el mismo formateador que la frase de
    // abajo: sin esto, el grafico decia «2109» encima de un pie que decia
    // «2,109». Dos formatos para el mismo numero, a dos centimetros.
    text: [estado.aulas ? fmt(estado.aulas) : ""],
    textposition: "inside",
    // Sin esto Plotly escribe su gris #444 encima del relleno: sobre
    // «sin agendar» daba 2,66 de contraste y la cifra no se leia.
    insidetextfont: fuenteDeCifraEnBarra(tintaSobre(estado.color)),
    insidetextanchor: "middle",
    hovertemplate: `${estado.etiqueta}: %{x} de ${total}<extra></extra>`,
  }));

  return (
    // C1: quién posee el espacio interior del panel. Sin declararlo, el gate
    // cae a la cabecera como dueña y reporta sus 4-5 px de holgura como
    // `capacity-drift`, que es un diagnóstico sobre el sitio equivocado: el
    // panel sólo tiene 1 px libre abajo y el hueco está dentro del head.
    <div className="aulas-estado-chart" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <PlotlyChart
        data={data}
        height={104}
        ariaLabel="Cursos-horario por estado de aplicación"
        layout={{
          // La escala de eje del perfil, no el default compartido de Plotly.
          font: fuenteDeEjeAulas(),
          barmode: "stack",
          margin: { l: 8, r: 8, t: 30, b: 8 },
          xaxis: { visible: false, fixedrange: true },
          yaxis: { visible: false, fixedrange: true },
          // Igual que en brecha por estrato: `PlotlyChart` esconde la leyenda
          // por defecto, y aquí sin ella los cuatro colores no dicen nada.
          showlegend: true,
          // E17 (criterio de los dictados: sin interactividad fantasma): el
          // click en la leyenda escondía un tramo y RE-ESCALABA la barra —
          // ocultar «En reserva» convertía 190/1392 en casi todo el ancho sin
          // ningún aviso. La leyenda informa, no filtra.
          legend: { orientation: "h", y: 1.5, x: 0, traceorder: "normal", itemclick: false, itemdoubleclick: false },
          bargap: 0.35,
        }}
        config={{ displayModeBar: false, responsive: true }}
      />
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
