import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { fuenteDeEjeAulas } from "./ejesDeAulas";
import { COLOR_SEPARADOR_BARRA } from "../../coloresDeResultado";
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

/** Las que de verdad tienen que salir a campo: ni dormidas ni de banco. */
function enJuegoDe(estados: ReadonlyArray<TramoContado>, banco?: number): number {
  const vivas = estados
    .filter((e) => e.clave !== "en_reserva")
    .reduce((n, e) => n + e.aulas, 0);
  return Math.max(0, vivas - (banco ?? 0));
}

const acotar = (n: number, techo: number) => Math.min(Math.max(n, 0), techo);

/**
 * Dónde están las que no cuentan como «en juego».
 *
 * Son dos cosas distintas y la frase las metía en una: las ENCADENADAS esperan
 * a que caiga su titular, y el BANCO es capacidad sin asignar a nadie. Decir de
 * las 2.423 que «sólo entran si cae su titular» es falso para 1.916 de ellas.
 */
function dondeEstanLasOtras(fuera: number, banco: number): string {
  const dormidas = Math.max(0, fuera - banco);
  const enBanco = Math.min(banco, fuera);
  if (dormidas > 0 && enBanco > 0) {
    return `Las otras ${fmt(dormidas)} esperan en reserva —sólo entran si cae su titular— y ${fmt(enBanco)} están en el banco.`;
  }
  if (enBanco > 0) return `Las otras ${fmt(enBanco)} están en el banco, sin asignar a ninguna cadena.`;
  return `Las otras ${fmt(dormidas)} esperan en reserva: sólo entran si cae su titular.`;
}

export function AulasEstadoChart({ filas, resumen, desconocidasMotor, bancoMotor }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** El reparto del motor, sobre TODAS las filas y no sobre las 500 que viajan. */
  resumen?: ReadonlyArray<{ clave: string; aulas: number }> | null;
  /** Estados que el motor no supo clasificar: se declaran, no se tragan. */
  desconocidasMotor?: number;
  /**
   * Cuántas de las filas son del banco, contadas por el motor sobre TODAS.
   *
   * `enJuego` las descontaba por ESTADO —las de clave `en_reserva`— y eso sólo
   * funciona si el motor marca el banco así. Medido el 2026-08-23 sobre el
   * sorteo del 22: clasificó las 507 reservas encadenadas como `en_reserva` y
   * las 1.916 del banco como «Sin agendar», así que el pie decía «2.109 de
   * 2.109 cursos-horario en juego todavía no salen a campo» sobre un operativo
   * de 193 visitas. Diez veces el trabajo que hay.
   *
   * El motor ya lo contaba —`attr(recortado, "banco")`, con `en_juego_cs`
   * excluyendo el banco explícitamente— y lo emite como
   * `course_status_banco`. Sólo faltaba consumirlo.
   */
  bancoMotor?: number;
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
            // El numerador descuenta el banco IGUAL que el denominador. Al
            // arreglar sólo el de abajo, la frase quedó en «2.109 de 193», que
            // es la misma mitad-y-mitad de antes con los papeles cambiados:
            // el banco cae en `pendiente`, así que estaba en los dos lados.
            // Acotado a [0, en juego] porque un desglose incoherente no puede
            // producir un numerador negativo ni mayor que su total.
            sinSalirACampo: acotar(
              estados
                .filter((e) => e.clave === "pendiente" || e.clave === "lista")
                .reduce((n, e) => n + e.aulas, 0) - (bancoMotor ?? 0),
              enJuegoDe(estados, bancoMotor),
            ),
            // **El denominador de esa frase no es el total.**
            //
            // «5 de 269 cursos-horario todavía no salen a campo» se lee como que
            // los otros 264 sí salieron, y 70 de esos 269 son reservas del banco
            // que NO van a salir salvo que caiga su titular. El numerador ya las
            // excluía —sólo suma `pendiente` y `lista`— y el denominador las
            // metía: la mitad de la fracción contaba una cosa y la otra mitad,
            // otra. Las que están en juego son el total menos las dormidas.
            // Menos las dormidas por estado Y menos el banco, que el motor
            // cuenta aparte porque no siempre cae en `en_reserva`.
            enJuego: enJuegoDe(estados, bancoMotor),
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
    [filas, resumen, desconocidasMotor, bancoMotor],
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

  const data = estados.map((estado) => ({
    type: "bar",
    orientation: "h",
    name: estado.etiqueta,
    y: ["Cursos-horario"],
    x: [estado.aulas],
    marker: {
      color: estado.color,
      // El trazo blanco es lo que deja ver la frontera entre dos segmentos
      // contiguos cuando uno de ellos es muy corto.
      line: { color: COLOR_SEPARADOR_BARRA, width: 1 },
    },
    // La etiqueta de la barra pasa por el mismo formateador que la frase de
    // abajo: sin esto, el grafico decia «2109» encima de un pie que decia
    // «2,109». Dos formatos para el mismo numero, a dos centimetros.
    text: [estado.aulas ? fmt(estado.aulas) : ""],
    textposition: "inside",
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
        ariaLabel="Cursos-horario por status de aplicación"
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
          legend: { orientation: "h", y: 1.5, x: 0, traceorder: "normal" },
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

            «en reserva» y NO «en el banco»: son dos conjuntos distintos y la
            frase llamaba banco al que no lo es. Medido el 2026-08-23 sobre el
            sorteo del 22, las dos frases convivían en la misma pantalla —«las
            otras 507 son reservas que esperan en el banco» y «1.916 son
            reservas del banco»—, con la misma palabra para 507 y para 1.916.
            Las 507 están ENCADENADAS a un titular concreto; el banco es
            capacidad sin asignar. */}
        {total > enJuego ? ` ${dondeEstanLasOtras(total - enJuego, bancoMotor ?? 0)}` : ""}
        {/* Un estado que el motor no declare se dice, no se descarta: es el
            mismo patrón de lista cerrada que ya costó doce ítems. */}
        {desconocidas
          ? ` ${desconocidas} en un estado que esta vista no reconoce.`
          : ""}
      </p>
    </div>
  );
}
