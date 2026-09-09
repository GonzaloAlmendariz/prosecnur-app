import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { AulasCuotasResumen } from "./AulasCuotasResumen";

/**
 * La causa del cero, donde se lee el cero.
 *
 * `monitoreo_aulas_avance_cuota.R:518` ya detectaba el caso —la columna de sexo
 * existe y ninguno de sus valores se reconoce, porque una base de Kobo sin
 * decodificar trae el NOMBRE de la opción del XLSForm y el instrumento de
 * HSVG2026 usa `1` = Mujer y `2` = Hombre— y publicaba la causa con los valores
 * que llegaron, sin adivinar cuál código es cuál. Ese aviso viajaba en la
 * columna `warning` de todas las filas y la UI lo pintaba SÓLO como una columna
 * más de la tabla, rotulada «Advertencia» y repetida treinta veces.
 *
 * Mientras tanto, este panel decía «0 de 30 celdas cumplidas» sobre mil
 * quinientas respuestas ya atribuidas a su aula, y quien lo leyera salía a
 * revisar el enlace del recopilador.
 */

const AVISO =
  "La columna «sexo» trae valores que no se reconocen como sexo (1, 2). " +
  "Se esperan etiquetas como «Mujer»/«Hombre» o «F»/«M».";

const fila = (p: Record<string, unknown>) => p as MonitoreoRow;

const conAviso = (aviso: string) => [
  fila({ faculty: "Derecho", sex: "F", target: 100, observed: 0, warning: aviso }),
  fila({ faculty: "Derecho", sex: "M", target: 100, observed: 0, warning: aviso }),
];

describe("el aviso del sexo sin decodificar llega a la pantalla", () => {
  it("se pinta encima de las cifras que explica", () => {
    const html = renderToStaticMarkup(<AulasCuotasResumen filas={conAviso(AVISO)} />);
    expect(html).toContain("no se reconocen como sexo");
    // Encima, no debajo: quien ve un cero deja de leer.
    // Ancla en la LECTURA y no en «Cuota del estudio», que era la etiqueta de la
    // barra del total. Esa barra se retiró el 2026-09-08 por publicar por tercera
    // vez «494 de 2 500 · 19,8 %» en la misma pantalla. Lo que este test fija
    // —que el aviso va ANTES de las cifras— no cambia.
    expect(html.indexOf("aulas-cuota-aviso")).toBeLessThan(html.indexOf("grupos con su cuota cumplida"));
  });

  it("sin aviso no se inventa un hueco", () => {
    // El control del mutante: si el bloque se pintara siempre, quedaría un
    // marco vacío encima de la barra en todos los estudios sanos.
    const html = renderToStaticMarkup(<AulasCuotasResumen filas={conAviso("")} />);
    expect(html).not.toContain("aulas-cuota-aviso");
    expect(html).toContain("grupos con su cuota cumplida");
  });

  it("y también cuando no hay ni una celda con objetivo", () => {
    // Ahí el panel ya tenía su vacío declarado, pero un «el plan no declara
    // composición por sexo» sería FALSO cuando lo que pasa es que las
    // respuestas vienen en código: el plan sí la declara.
    const html = renderToStaticMarkup(
      <AulasCuotasResumen filas={[fila({ faculty: "Derecho", sex: "F", target: 0, observed: 0, warning: AVISO })]} />,
    );
    expect(html).toContain("no se reconocen como sexo");
    expect(html).not.toContain("no declara composición por sexo");
  });
});
