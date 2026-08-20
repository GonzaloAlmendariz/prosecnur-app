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
