import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasControlDelLibro } from "./AulasControlDelLibro";

/**
 * El veredicto de la tabla sale del motor, no de releer la celda.
 *
 * Este guard existe porque las dos fuentes del mismo hecho discrepaban en los
 * DOS sentidos y ninguna pasada visual podía verlo: el fixture sólo escribe 1,
 * 0 o vacío en esas celdas, así que las dos ramas que fallaban no aparecían
 * nunca en pantalla. Salió de correr el motor con celdas que el equipo sí
 * puede escribir a mano en su Excel.
 */

const base = {
  operational_code: "CH 1",
  course_name: "Curso",
  grupos_con_dato: ["cuenta"],
};

function marcas(fila: Record<string, unknown>) {
  const html = renderToStaticMarkup(
    <AulasControlDelLibro
      filas={[{ ...base, ...fila }]}
      resumen={{ aulas: 1, grupos: [{ clave: "cuenta", etiqueta: "Control - cuenta", campos: 14, aulas_con_dato: 1 }] } as never}
    />,
  );
  return html;
}

describe("AulasControlDelLibro · la tasa de efectividad", () => {
  function titular(veredicto: Record<string, number>, aulas: number) {
    return renderToStaticMarkup(
      <AulasControlDelLibro
        filas={[]}
        resumen={{ aulas, grupos: [], veredicto } as never}
      />,
    );
  }

  it("divide entre las evaluadas, no entre las filas del libro", () => {
    // 23 efectivas de 152 filas con 50 sin evaluar. Dividir entre 152 da 15 %,
    // que no mide el campo: sube solo porque el equipo termine de llenar la
    // hoja y baja en cuanto se añaden filas vacías. Entre las 102 evaluadas
    // son 23 %.
    const html = titular(
      { efectivas: 23, cumple_una: 29, no_efectivas: 50, indeterminadas: 50, solo_asistentes: 24, solo_poblacion: 5 },
      152,
    );
    expect(html).toContain("<strong>23</strong> efectivas de 102 evaluadas");
    expect(html).toContain("23 %");
    expect(html).not.toContain("15 %");
  });

  it("con cero evaluadas no hay porcentaje que enseñar", () => {
    // El caso de un estudio que genero su libro y aun no lo lleno: 26 filas,
    // ninguna evaluada. Un «0 %» ahi se lee como «ninguna llego», y lo cierto
    // es que ninguna se ha mirado. La cifra existiria pero no mediria nada.
    const html = titular(
      { efectivas: 0, cumple_una: 0, no_efectivas: 0, indeterminadas: 26, solo_asistentes: 0, solo_poblacion: 0 },
      26,
    );
    // Se mira el TITULAR y no el html entero: la matriz de umbrales de arriba
    // dice «100 %» legitimamente, y un `not.toContain("0 %")` global lo caza
    // por dentro. Un aserto demasiado ancho falla por donde no es.
    const titularHtml = html.slice(html.indexOf('class="aulas-control-titular"'));
    expect(titularHtml).toContain("efectivas de 0 evaluadas");
    expect(titularHtml.slice(0, titularHtml.indexOf("</p>"))).not.toContain("%");

    // El control: con evaluadas de verdad el porcentaje SI sale, para que este
    // aserto no pase por no encontrar nunca un porcentaje.
    const conDatos = titular(
      { efectivas: 5, cumple_una: 3, no_efectivas: 2, indeterminadas: 0, solo_asistentes: 2, solo_poblacion: 1 },
      10,
    );
    expect(conDatos).toContain("50 %");
  });

  it("sin ninguna sin evaluar, el denominador vuelve a ser las filas y la palabra sobra", () => {
    // El control: con `indeterminadas` en cero las dos fórmulas coinciden, así
    // que este caso NO distingue cuál está implementada; está para fijar que la
    // palabra «evaluadas» no se cuela cuando no hace falta decirla.
    const html = titular({ efectivas: 5, cumple_una: 3, no_efectivas: 2, indeterminadas: 0 }, 10);
    expect(html).toContain("<strong>5</strong> de 10 aulas efectivas");
    expect(html).toContain("50 %");
  });
});

describe("AulasControlDelLibro · veredicto por aula", () => {
  it("una celda ilegible queda INDETERMINADA, no «no válido»", () => {
    // El motor deja `cumple_total` en null ante «PENDIENTE» y el aula no cuenta
    // como efectiva. La marca vieja la mandaba a «✗ No válido» —acusar a un
    // aula de no llegar cuando lo que pasa es que nadie la evaluó—.
    const html = marcas({
      valid_total: "PENDIENTE",
      cumple_total: null,
      valid_population: "1",
      cumple_poblacion: true,
    });
    expect(html).toContain("La hoja dice «PENDIENTE»");
    expect(html).toContain("Válido, según la hoja");
    // El control: si el veredicto se siguiera leyendo de la celda, «PENDIENTE»
    // saldría con la marca de no válido y este aserto caería.
    expect(html).not.toContain("No válido");
  });

  it("una celda vacía que el motor resolvió por umbral se ve, y se dice que la calculó la app", () => {
    // 30 enviadas contra un umbral de 20 que trae la propia hoja: el motor
    // declara el aula efectiva y la cuenta arriba. La marca vieja dibujaba «—»,
    // o sea «sin dato» sobre un aula que el mismo panel ya contó como efectiva.
    const html = marcas({
      valid_total: "",
      cumple_total: true,
      threshold_total: 20,
      sent_total: 30,
      valid_population: "",
      cumple_poblacion: false,
      threshold_population: 40,
    });
    expect(html).toContain("es-derivado");
    expect(html).toContain("Lo calculó la app: 30 enviadas contra el umbral 20");
    expect(html).not.toContain("La hoja no trae el veredicto y no hay umbral");
  });

  it("sin veredicto y sin umbral sí es un hueco de la hoja", () => {
    const html = marcas({ valid_total: "", cumple_total: null, valid_population: "", cumple_poblacion: null });
    expect(html).toContain("La hoja no trae el veredicto y no hay umbral con qué calcularlo");
    expect(html).not.toContain("aulas-control-marca");
  });
});
