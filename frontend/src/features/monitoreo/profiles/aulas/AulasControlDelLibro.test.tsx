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
    // 23 efectivos de 152 grupos con 50 sin evaluar. Dividir entre 152 da 15 %,
    // que no mide el campo: sube solo porque el equipo termine de llenar la
    // hoja y baja en cuanto se añaden filas vacías. Entre las 102 evaluadas
    // son 23 %.
    const html = titular(
      { efectivas: 23, cumple_una: 29, no_efectivas: 50, indeterminadas: 50, solo_asistentes: 24, solo_poblacion: 5 },
      152,
    );
    expect(html).toContain("<strong>23</strong> efectivos de 102 grupos evaluados");
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
    expect(titularHtml).toContain("efectivos de 0 grupos evaluados");
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
    expect(html).toContain("<strong>5</strong> de 10 grupos de curso-horario y sexo");
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

describe("AulasControlDelLibro · la banda de pérdida no lee el veredicto", () => {
  // A20 (censo de las cuatro cifras 2026-09-01, choque 1): la banda compara lo
  // que la hoja da por ENVIADO (`sent_total`, la cuenta del equipo) contra la
  // efectiva de PLATAFORMA que la app escribe en la MISMA hoja
  // (`efectivas_obtenidas`). `valid_total` es el veredicto de la columna de al
  // lado y jamás entra como cifra: con banderas 0/1 la banda decía «De 770
  // enviadas cuentan 2 (0 % pasa)» y con «SI»/«NO» se apagaba entera.
  //
  // La copy exacta es del writer: aquí se fijan las CIFRAS que la banda puede
  // y no puede decir, leídas del texto del párrafo sin sus etiquetas.
  function banda(filas: Array<Record<string, unknown>>) {
    const html = renderToStaticMarkup(
      <AulasControlDelLibro
        filas={filas.map((f, i) => ({ operational_code: `CH ${i + 1}`, grupos_con_dato: ["cuenta"], ...f }))}
        resumen={{
          aulas: filas.length,
          grupos: [
            { clave: "cuenta", etiqueta: "Control - cuenta", campos: 14, aulas_con_dato: filas.length },
            { clave: "esperado", etiqueta: "Control - esperado", campos: 6, aulas_con_dato: filas.length },
          ],
        } as never}
      />,
    );
    const desde = html.indexOf('class="aulas-perdida"');
    if (desde < 0) return null;
    // Sólo el párrafo de la banda: la tabla de abajo repite las mismas cifras
    // celda a celda y un aserto global las cazaría por donde no es.
    return html.slice(desde, html.indexOf("</p>", desde)).replace(/<[^>]+>/g, " ");
  }

  it("con banderas 0/1 no dice que de 770 enviadas cuentan 2", () => {
    const texto = banda([
      { sent_total: 300, valid_total: 1, efectivas_obtenidas: 271 },
      { sent_total: 250, valid_total: 0, efectivas_obtenidas: 224 },
      { sent_total: 220, valid_total: 1, efectivas_obtenidas: 205 },
    ]);
    expect(texto).not.toBeNull();
    expect(texto!).toMatch(/\b700\b/); // la efectiva de plataforma, sumada
    expect(texto!).toMatch(/\b91\s*%/); // 700 de 770
    expect(texto!).not.toMatch(/\b768\b/); // la pérdida fabricada del veredicto
    expect(texto!).not.toMatch(/\b0\s*%/);
  });

  it("con «SI»/«NO» en el veredicto la banda no se apaga", () => {
    // La lectura vieja mandaba estas dos filas a «sin revisar» y la banda no se
    // dibujaba: una hoja llena declarada vacía.
    const texto = banda([
      { sent_total: 100, valid_total: "SI", efectivas_obtenidas: 91 },
      { sent_total: 50, valid_total: "NO", efectivas_obtenidas: 44 },
    ]);
    expect(texto).not.toBeNull();
    expect(texto!).toMatch(/\b150\b/);
    expect(texto!).toMatch(/\b135\b/);
    expect(texto!).toMatch(/\b90\s*%/);
  });

  it("2 009 enviadas y 1 811 efectivas de plataforma: se pierden 198", () => {
    // `fmt()` pasa por Intl y el separador de miles depende del ICU del runner
    // (la memoria del repo tiene el caso): el regex admite cualquiera.
    const texto = banda([{ sent_total: 2009, efectivas_obtenidas: 1811, valid_total: "CUMPLE" }]);
    expect(texto).not.toBeNull();
    expect(texto!).toMatch(/2[\s.,]?009/);
    expect(texto!).toMatch(/1[\s.,]?811/);
    expect(texto!).toMatch(/\b198\b/);
    expect(texto!).toMatch(/\b90\s*%/);
  });

  it("la fila sin efectiva de plataforma no fabrica pérdida ni infla las enviadas", () => {
    const texto = banda([
      { sent_total: 100, efectivas_obtenidas: 91, valid_total: "SI" },
      { sent_total: 200, efectivas_obtenidas: 180 },
      { sent_total: 40 },
    ]);
    expect(texto).not.toBeNull();
    expect(texto!).toMatch(/\b300\b/); // sólo las filas comparadas
    expect(texto!).toMatch(/\b271\b/);
    expect(texto!).toMatch(/\b29\b/);
    expect(texto!).not.toMatch(/\b340\b/); // la excluida no entra al total
    // Cuántas quedaron fuera lo declara el resultado (`sinRevisar`, pineado en
    // perdidaDelControl.test.ts); la frase con que la banda lo diga es del
    // writer.
  });

  it("la columna «Válido total» sigue pintando el veredicto, no una cifra", () => {
    // El verde a conservar: el mismo campo, dos líneas más abajo de la banda,
    // es una marca de sí/no que sale del motor. El arreglo de la banda no
    // puede llevárselo.
    const html = renderToStaticMarkup(
      <AulasControlDelLibro
        filas={[{
          operational_code: "CH 1",
          grupos_con_dato: ["cuenta"],
          sent_total: 300,
          efectivas_obtenidas: 271,
          valid_total: "1",
          cumple_total: true,
        }]}
        resumen={{ aulas: 1, grupos: [{ clave: "cuenta", etiqueta: "Control - cuenta", campos: 14, aulas_con_dato: 1 }] } as never}
      />,
    );
    expect(html).toContain('title="Válido total"');
    expect(html).toContain("Válido, según la hoja");
  });
});

/**
 * A3: el aviso de ALUMNOS EN AULA vive dentro de la Base de control, con la
 * causa y la salida, y sólo cuando hay algo que decir.
 */
describe("AulasControlDelLibro · el aviso de asistencia sin parte", () => {
  const resumen = { aulas: 2, grupos: [{ clave: "cuenta", etiqueta: "Control - cuenta", campos: 14, aulas_con_dato: 2 }] } as never;
  const filas = [
    { ...base, operational_code: "CH 7", observed_students: "NA" },
    { ...base, operational_code: "CH 72", observed_students: 53 },
  ];

  it("nombra el curso-horario sin parte y dice dónde se llena", () => {
    const html = renderToStaticMarkup(
      <AulasControlDelLibro filas={filas} resumen={resumen} partes={[{ operational_code: "CH 72", observed_students: 53 }]} />,
    );
    expect(html).toContain("1 curso-horario aplicado sin parte de campo (CH 7)");
    expect(html).toContain("Registro de campo");
    expect(html).toContain('data-tono="atencion"');
  });

  it("con todo cubierto no pinta el aviso", () => {
    const html = renderToStaticMarkup(
      <AulasControlDelLibro
        filas={[{ ...base, operational_code: "CH 72", observed_students: 53 }]}
        resumen={{ aulas: 1, grupos: [] } as never}
        partes={[{ operational_code: "CH 72", observed_students: 53 }]}
      />,
    );
    expect(html).not.toContain("sin parte de campo");
  });
});
