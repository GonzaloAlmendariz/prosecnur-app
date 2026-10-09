import { useMemo } from "react";
import { contar } from "../../fuentes/vocabulario";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { fuenteDeEjeAulas } from "./ejesDeAulas";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { brechaPorEstrato } from "./brechaPorEstrato";
import { etiquetaDeEstrato } from "./etiquetaDeEstrato";
import { fmt } from "./kpisDeAulas";

/** El mismo formato que el resto del perfil: «3,743» y no «3743». */

/**
 * ⚠ SIN MONTAR desde el 2026-08-29.
 *
 * Dibujaba el estrato del SORTEO —`FACULTAD / F / G3`, que la etiqueta traduce
 * como «mayoría mujeres · 41 alumnos o más»— y ese sexo es el dominante del
 * aula, no el del alumno. Gonzalo: «cómo vas a poner mayoría hombres o mayoría
 * mujeres cuando eso no me interesa; lo que me interesa es cuántos hombres y
 * cuántas mujeres». El panel pasó a `AulasSexoPorFacultadChart`, que sale de la
 * celda de cuota.
 *
 * **No se borra sin decidirlo aparte.** La lectura por estrato de diseño sigue
 * siendo válida para otra pregunta —si el sorteo cubrió sus grupos— y ese es un
 * panel que no existe todavía. Si se decide que no hace falta, se borra con su
 * test y su entrada en `componentesSinMontar`.
 *
 * **Y si se decide montarlo, su denominador hay que decirlo.** Medido el
 * 2026-08-30 sobre `HSVG2026_sem15_como_2025`: los 72 estratos suman **891** de
 * brecha, mientras el estudio entero debe **170**. Las válidas coinciden —2.668
 * en los dos— así que no es un error de cuenta: el estrato es
 * `facultad / sexo / tamaño` y sus brechas no se compensan entre grupos de
 * tamaño, mientras la cuota se mide sobre `facultad / sexo`. Montado tal cual, y
 * como este componente publica `brechaTotal`, la pantalla diría «faltan 891» a
 * dos paneles de un «faltan 170» sin nada que los reconcilie: exactamente la
 * clase de contradicción que ya obligó a renombrar los dos «Cumplimiento» de
 * Avance.
 *
 * Dónde falta más, de un vistazo.
 *
 * La tabla de `avance_por_estrato` trae los mismos números, pero contesta mal la
 * pregunta del día siguiente: hay que leer diez filas y restar de cabeza. Aquí
 * el estrato con la barra ámbar más larga es el destino, y la verde de al lado
 * dice cuánto lleva recogido para no confundir «falta mucho» con «no ha
 * empezado».
 */
export function AulasBrechaEstratoChart({ filas }: { filas: ReadonlyArray<MonitoreoRow> }) {
  const resumen = useMemo(() => brechaPorEstrato(filas), [filas]);
  const { estratos, omitidos, brechaOmitida, brechaTotal, cerrados, total } = resumen;

  if (!total) {
    return <p className="mon-profile-muted">El plan no declara estratos que comparar.</p>;
  }
  if (!brechaTotal) {
    // No es un vacío: es la mejor noticia posible del operativo, y decirla como
    // «no hay datos» la haría parecer un fallo.
    return (
      <p className="mon-profile-muted">
        Los {total} estratos alcanzaron su meta: no queda brecha que repartir.
      </p>
    );
  }

  // **El resto NO entra como barra, y lo probé.**
  //
  // Con estratos de verdad —`FACULTAD / SEXO / TAMAÑO`, 56 en el estudio— el
  // corte de doce deja fuera 44 que suman 858 de las 1 580 que faltan, así que
  // el gráfico dibuja el 46 % del problema. Metí una barra «Otros 44 estratos»
  // para que esa masa se viera… y la medición después la tumbó: con 858 contra
  // los 89 del mayor, la escala pasa a fijarla el agregado y **los doce
  // estratos reales quedan comprimidos en el 10 % izquierdo**. Comparar
  // estratos entre sí es justo para lo que existe este panel.
  //
  // Lo que sí faltaba era el PESO de lo que se dibuja, que es lo que un lector
  // no puede calcular de cabeza: va abajo, en el pie.
  // Plotly dibuja el primer elemento abajo: se invierte para que el estrato con
  // más brecha quede arriba, que es donde cae la vista.
  const orden = [...estratos].reverse();
  const parteDibujada = brechaTotal > 0
    ? Math.round((100 * (brechaTotal - brechaOmitida)) / brechaTotal)
    : 0;
  const data = [
    {
      type: "bar",
      orientation: "h",
      // «Efectivas» por D-L12: la respuesta que pasa los filtros se llama
      // efectiva. La cifra es `respuestas_validas` —la efectiva de PLATAFORMA—,
      // no `CANTIDAD DE EFECTIVAS`, que es la columna del parte de campo y otra
      // cuenta (una versión anterior de este comentario citaba esa columna como
      // procedencia, y era la equivocada). «Recogidas» era mío.
      name: "Efectivas",
      y: orden.map((e) => etiquetaDeEstrato(e.estrato)),
      x: orden.map((e) => e.validas),
      marker: { color: COLOR_RESULTADO.efectiva },
      hovertemplate: "%{y}: %{x} efectivas<extra></extra>",
    },
    {
      type: "bar",
      orientation: "h",
      name: "Faltan",
      y: orden.map((e) => etiquetaDeEstrato(e.estrato)),
      x: orden.map((e) => e.brecha),
      marker: { color: COLOR_RESULTADO.parcial },
      text: orden.map((e) => (e.brecha ? String(e.brecha) : "")),
      textposition: "outside",
      cliponaxis: false,
      hovertemplate: "%{y}: faltan %{x}<extra></extra>",
    },
  ];

  return (
    // Igual que en cobertura: el envoltorio reserva el alto porque el div de
    // Plotly no empuja su fila del grid.
    <div className="aulas-cobertura-chart">
      <PlotlyChart
        data={data}
        height={Math.max(200, 34 * orden.length + 56)}
        // «Efectivas», como la leyenda y el hover: el mismo eje con tres
        // nombres —«Respuestas recogidas», «respuestas», «efectivas»— era un
        // tercer rótulo para la misma cifra.
        ariaLabel="Efectivas y brecha por estrato"
        layout={{
          // La escala de eje del perfil, no el default compartido de Plotly.
          font: fuenteDeEjeAulas(),
          barmode: "stack",
          margin: { l: 8, r: 52, t: 30, b: 28 },
          xaxis: { title: { text: "efectivas" }, zeroline: false, fixedrange: true },
          yaxis: { automargin: true, fixedrange: true },
          // `PlotlyChart` esconde la leyenda por defecto —casi todos sus usos
          // tienen una serie— y aquí sin ella el verde no se explica: la barra
          // se leería como una sola magnitud. Va arriba, que es donde se lee
          // antes de mirar las barras.
          showlegend: true,
          // `traceorder: normal`: apilado, Plotly invierte la leyenda y la
          // dejaba como «Faltan · Recogidas», al revés de como se lee la barra.
          // E17: leyenda que informa, no que filtra (mismo motivo que en el
          // chart de estado — el toggle re-escala y engaña).
          legend: { orientation: "h", y: 1.16, x: 0, traceorder: "normal", itemclick: false, itemdoubleclick: false },
          bargap: 0.3,
        }}
        config={{ displayModeBar: false, responsive: true }}
      />
      {/* Las cifras con separador de miles, como en TODO el resto del perfil.
          Este pie escribía «Faltan 3743» y «suman 1332» en crudo, dos dedos
          debajo de paneles que dicen «3,743»: la misma cifra con dos formatos en
          la misma pantalla se lee como si fueran dos números distintos. */}
      <p className="mon-profile-table-recorte">
        Faltan {fmt(brechaTotal)} respuestas en total.
        {cerrados ? ` ${cerrados} ${cerrados === 1 ? "estrato ya alcanzó" : "estratos ya alcanzaron"} su meta.` : ""}
        {/* El recorte se declara con su brecha Y con su PESO: «no se dibujan 44»
            no dice si eso es el margen o la mitad del problema, y aquí es el
            54 %. Sin el porcentaje, quien mira las doce barras cree que está
            viendo el estudio. */}
        {omitidos
          // «estrato» es masculino: «las otras 44 estratos» era lo que salía al
          // pegar un artículo femenino a lo que devuelve `contar()`.
          ? ` Los ${estratos.length} que se dibujan son el ${parteDibujada} % de lo que falta; los otros ${contar(omitidos, "estrato", "estratos")} suman ${fmt(brechaOmitida)}.`
          : ""}
      </p>
    </div>
  );
}
