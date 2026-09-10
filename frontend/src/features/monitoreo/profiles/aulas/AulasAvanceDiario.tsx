import type { ReactNode } from "react";

import { marcasDelEjeDeDias } from "./marcasDelEjeDeDias";
import { fmt } from "./kpisDeAulas";
import { ejeDeDias, serieSobreElEje } from "./ejeDeDias";
import type { DiaDeRitmo } from "./AulasRitmoDiario";
import "./aulasAvanceDiario.css";

/**
 * «Avance diario»: las efectivas de cada día en barras y el acumulado en línea,
 * cada uno con su propio eje.
 *
 * **Es el gráfico que Gonzalo dibujó**, y su reclamo del 2026-09-10: «no estás
 * tomando en cuenta mi artefacto donde dejé varios gráficos a utilizar, como el
 * avance diario». El dato ya estaba en la app —`{fecha, validas, acumulado}`—
 * pero se enseñaba como una tabla de diez filas con el acumulado en una celda:
 * la cifra estaba y la CURVA no, que es lo que dice si el ritmo se sostiene.
 *
 * **Por qué dos ejes y no uno.** El acumulado llega a 944 y el mejor día son
 * 341: en un eje común las barras quedarían aplastadas contra el suelo, que es
 * justo lo que este panel no puede permitirse. Cada serie tiene su escala y su
 * rótulo del color de su serie, como en el boceto.
 *
 * SVG a mano y no Plotly: son los días de un operativo —diez en este estudio— y
 * esta pestaña ya carga bastante. Misma decisión que la agenda por día.
 */

const ALTO = 250;
const PAD = { arriba: 22, abajo: 44, izq: 52, der: 56 };

/**
 * **El ancho del dibujo es fijo y el SVG se estira al panel.**
 *
 * El boceto calculaba `max(420, 90·días + 140)` y con tres jornadas daba 420 px
 * dentro de un panel de 1 155: medido en pantalla el 2026-09-10, **735 px de
 * panel en blanco a la derecha**. Es el mismo reclamo que ya me había hecho —
 * «¿por qué no ocupas todo el ancho?»— y con datos de arranque de operativo
 * sale siempre, que es justo cuando más se mira el tablero.
 *
 * Con un `viewBox` de ancho fijo y `width: 100%` en la hoja, el navegador escala
 * el dibujo al panel: las proporciones se conservan y el texto crece con él.
 * 1 100 está elegido para que sobre un panel de ~1 155 la escala sea ~1,05 y los
 * 10 px de los rótulos sigan siendo 10 px en pantalla.
 */
const ANCHO = 1100;

/**
 * Dónde cae el día `i` de `n` dentro del ancho útil, en FRACCIÓN de 0 a 1.
 *
 * Se exporta porque el pronóstico de cierre dibuja sobre el mismo eje y tiene
 * que poner sus fechas exactamente donde las pone este gráfico. Dos fórmulas
 * distintas —una al centro del hueco y otra en los extremos— desplazan las
 * series medio día y la alineación se pierde justo donde se mira.
 */
export const MARGEN_EJE = { izq: PAD.izq / ANCHO, der: PAD.der / ANCHO };

export function fraccionDelDia(i: number, n: number): number {
  if (n <= 0) return MARGEN_EJE.izq;
  const util = 1 - MARGEN_EJE.izq - MARGEN_EJE.der;
  return MARGEN_EJE.izq + (util * (i + 0.5)) / n;
}

/**
 * El techo del eje, redondeado hacia arriba a una cifra que se pueda leer.
 *
 * El boceto usaba `max · 1,15` y en pantalla los ejes decían **189, 378** y
 * **519, 1038**: números que no significan nada y que obligan a interpolar para
 * situar una barra. Se sube al siguiente múltiplo «bonito» —1, 2, 2,5 o 5 por
 * potencia de diez— que deje aire sobre el máximo.
 */
export function techoLegible(maximo: number, aire: number): number {
  const objetivo = Math.max(maximo * aire, 1);
  const magnitud = 10 ** Math.floor(Math.log10(objetivo));
  for (const paso of [1, 2, 2.5, 5, 10]) {
    const techo = paso * magnitud;
    if (techo >= objetivo) return techo;
  }
  return 10 * magnitud;
}

/** «2026-09-08» → «08/09», que es como el boceto rotula el eje. */
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function AulasAvanceDiario({ dias, hasta }: {
  dias: ReadonlyArray<DiaDeRitmo>;
  /**
   * El último día del horizonte, para que el eje llegue hasta donde llega el
   * pronóstico de abajo.
   *
   * Gonzalo, 2026-09-10: «ahorita se ve vacío el ritmo de la recolección: igual
   * entiendo que hay días que todavía no hemos aplicado, pero pueden ponerse de
   * todas formas para que se complete el gráfico». Sin esto el eje termina en la
   * última jornada con respuestas —tres, en el operativo— y los dos gráficos
   * miden distancias distintas con la misma anchura.
   */
  hasta?: string;
}): ReactNode {
  if (!dias.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        Todavía no hay ningún día con efectivas.
      </p>
    );
  }

  // El eje va de la primera jornada al final del horizonte. Sin `hasta` se
  // queda en la última con respuestas, que es como estaba.
  const corte = dias[dias.length - 1]?.fecha ?? "";
  const eje = ejeDeDias(dias[0]?.fecha ?? "", hasta && hasta > corte ? hasta : corte, corte);
  const puntos = eje.length ? serieSobreElEje(eje, dias) : dias.map((d) => ({
    ...d, etiqueta: `${d.fecha.slice(8, 10)}/${d.fecha.slice(5, 7)}`,
    esDeCampo: true, pasado: true, tieneDato: true,
  }));

  const ancho = ANCHO;
  const util = { x: ancho - PAD.izq - PAD.der, y: ALTO - PAD.arriba - PAD.abajo };
  // **Los dos techos llevan aire Y son legibles.** Sin margen, la barra más alta
  // toca el borde y se lee como si el eje se hubiera quedado corto; sin
  // redondear, el eje dice 189 y 378, que no son cifras que nadie use para
  // situar una barra.
  const techoBarra = techoLegible(Math.max(...puntos.map((d) => d.validas), 1), 1.15);
  const techoLinea = techoLegible(Math.max(...puntos.map((d) => d.acumulado), 1), 1.1);
  // La barra no se estira sin límite: con tres jornadas sobre 1 100 px, un 50 %
  // del carril serían 170 px de barra, que se lee como un bloque y no como una
  // serie. El tope de 46 px es el del boceto.
  const ancho1 = Math.min(46, (util.x / puntos.length) * 0.5);
  // La MISMA fórmula que usa el pronóstico de abajo, y por eso vive fuera.
  const cx = (i: number) => ancho * fraccionDelDia(i, puntos.length);
  const yBarra = (v: number) => PAD.arriba + util.y * (1 - v / techoBarra);
  const yLinea = (v: number) => PAD.arriba + util.y * (1 - v / techoLinea);
  const suelo = yBarra(0);

  // Qué días llevan rótulo: los que tienen barra SIEMPRE, los extremos, y el
  // resto del horizonte repartido sin pisarse. Siete casos en su test.
  const marcas = new Set(marcasDelEjeDeDias(puntos));

  return (
    <div className="aulas-avdia" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <svg
        viewBox={`0 0 ${ancho} ${ALTO}`}
        // Sin `width`/`height` en el atributo: los pone la hoja al 100 % del
        // panel, que es lo que hace que el dibujo llene el ancho disponible.
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Efectivas por día y acumulado. ${puntos
          .filter((d) => d.tieneDato)
          .map((d) => `${diaMes(d.fecha)}: ${d.validas} en el día, ${d.acumulado} acumuladas`)
          .join("; ")}`}
      >
        {/* Tres reglas —0, mitad y techo— con su cifra a cada lado, cada una del
            color de SU serie: es lo único que evita leer la línea contra el eje
            de las barras. */}
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.izq} x2={ancho - PAD.der} y1={yBarra(techoBarra * t)} y2={yBarra(techoBarra * t)}
              className="aulas-avdia-regla" />
            <text x={PAD.izq - 7} y={yBarra(techoBarra * t) + 3.5} textAnchor="end"
              className="aulas-avdia-eje es-dia">{Math.round(techoBarra * t)}</text>
            <text x={ancho - PAD.der + 7} y={yLinea(techoLinea * t) + 3.5}
              className="aulas-avdia-eje es-acumulado">{Math.round(techoLinea * t)}</text>
          </g>
        ))}
        {puntos.map((d, i) => (
          <g key={d.fecha}>
            <rect x={cx(i) - ancho1 / 2} y={yBarra(d.validas)} width={ancho1}
              height={Math.max(0, suelo - yBarra(d.validas))} className="aulas-avdia-barra" />
            {/* La cifra del día ENCIMA de su barra. El boceto no la lleva, pero
                la tabla que este gráfico sustituye sí la tenía, y perderla para
                ganar la curva sería cambiar un dato por otro en vez de sumarlos. */}
            {d.validas > 0 ? (
              <text x={cx(i)} y={yBarra(d.validas) - 5} textAnchor="middle"
                className="aulas-avdia-valor">{fmt(d.validas)}</text>
            ) : null}
            {/* **Un rótulo de cada tres cuando el eje es largo.** Con veinticinco
                días las fechas se pisan unas con otras —él: «los días en el eje x
                no se ven bien»— y con tres caben todas. El primero y el último
                se rotulan siempre: son los extremos del horizonte. */}
            {puntos.length <= 10 || i % Math.ceil(puntos.length / 10) === 0 || i === puntos.length - 1 ? (
              <text x={cx(i)} y={ALTO - PAD.abajo + 16} textAnchor="middle"
                className={`aulas-avdia-fecha${d.esDeCampo ? "" : " es-sin-campo"}`}>{diaMes(d.fecha)}</text>
            ) : null}
          </g>
        ))}
        {/* La línea sólo recorre lo que YA PASÓ: prolongarla sobre el horizonte
            la convertiría en un pronóstico, y el pronóstico es el gráfico de
            abajo, que dibuja su abanico. */}
        <polyline className="aulas-avdia-linea" fill="none"
          points={puntos.filter((d) => d.pasado).map((d, i) => `${cx(i)},${yLinea(d.acumulado)}`).join(" ")} />
        {puntos.filter((d) => d.pasado).map((d, i) => (
          <circle key={d.fecha} cx={cx(i)} cy={yLinea(d.acumulado)} r={3.2} className="aulas-avdia-punto" />
        ))}
        <text x={PAD.izq} y={11} className="aulas-avdia-eje es-dia">efectivas del día</text>
        <text x={ancho - PAD.der} y={11} textAnchor="end"
          className="aulas-avdia-eje es-acumulado">acumulado</text>
      </svg>
    </div>
  );
}
