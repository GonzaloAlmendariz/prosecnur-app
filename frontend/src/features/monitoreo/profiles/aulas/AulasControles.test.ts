import { describe, expect, it } from "vitest";

import { controlesDeAulas, tramosDeControl } from "./AulasControles";

/**
 * Los controles de Validación se leen como avisos, no como filas de tabla.
 *
 * Lo que este guard fija: que lo que pide decisión va primero, que un estado
 * desconocido no desaparece, y que el texto pasa por la capa de presentación.
 * Ese último aserto vale porque ya falló: al pintar los controles fuera de la
 * tabla salieron a pantalla «field_report_reconciliation» y «El tablero agrega
 * por aula/collector/link», que es la jerga del motor que la traducción existe
 * para tapar.
 */

const filas = [
  { check: "anonymous_responses", status: "ok", detail: "El tablero agrega por aula/collector/link." },
  { check: "field_report_reconciliation", status: "review", detail: "CH 31 no cuadra." },
  { check: "sex_faculty_quota", status: "warning", detail: "10 celdas sexo x facultad con brecha." },
];

describe("los controles de Validación", () => {
  it("ponen delante lo que pide decisión", () => {
    const { controles } = controlesDeAulas(filas);
    expect(controles.map((c) => c.severidad)).toEqual(["revisar", "advertencia", "correcto"]);
  });

  it("cuentan cada severidad por separado", () => {
    const res = controlesDeAulas(filas);
    // Un correcto no desaparece: el gate es «verde por conformidad, no por
    // ausencia», así que se sigue viendo aunque en un renglón.
    expect([res.revisar, res.advertencias, res.correctos]).toEqual([1, 1, 1]);
  });

  it("un estado que el motor no declare no se pierde", () => {
    // Lista cerrada con salida declarada: si mañana el engine emite «bloqueante»
    // se ve como advertencia en vez de caer al grupo de los correctos.
    const { controles } = controlesDeAulas([{ check: "x", status: "bloqueante", detail: "" }]);
    expect(controles[0].severidad).toBe("advertencia");
  });

  it("el texto pasa por la capa de presentación", () => {
    const { controles } = controlesDeAulas(filas);
    const nombres = controles.map((c) => c.control);
    expect(nombres).toContain("Cuadre del parte de campo");
    expect(nombres).not.toContain("field_report_reconciliation");

    const anonimas = controles.find((c) => c.control === "Respuestas anónimas");
    expect(anonimas?.detalle).toContain("curso-horario, origen y enlace");
    expect(anonimas?.detalle).not.toContain("collector");

    const cuota = controles.find((c) => c.severidad === "advertencia");
    expect(cuota?.detalle).toContain("sexo por facultad");
    expect(cuota?.estado).toBe("Advertencia");
  });
});

/**
 * El detalle de un control enumera casos, y se leían como un párrafo corrido.
 *
 * El control que de verdad importa es el ÚLTIMO aserto: la cola —«Y 1
 * discrepancia más.»— iba pegada al último caso, así que el texto decía que esa
 * aula tenía una discrepancia más, cuando habla del conjunto. Si el parser
 * dejara de separarla, ese aserto es el único que se pondría rojo.
 */
describe("tramosDeControl", () => {
  it("parte la enumeración por aula y deja la cola aparte", () => {
    const tramos = tramosDeControl(
      "CH 71: el parte de campo pone 39 en los asistentes y la Base de control pone 36. " +
        "CH 71: el parte de campo pone 76.5 % en el % de asistencia y la Base de control pone 70.6 %. " +
        "CH 85: el parte de campo pone Equipo 2 en quién aplicó y la Base de control pone Equipo 9. " +
        "Y 1 discrepancia más.",
    );

    expect(tramos.map((t) => t.codigo)).toEqual(["CH 71", "CH 71", "CH 85", ""]);
    // El decimal NO parte la frase: «76.5 %» vive dentro de su caso.
    expect(tramos[1].texto).toContain("76.5 %");
    expect(tramos[2].texto).toBe("el parte de campo pone Equipo 2 en quién aplicó y la Base de control pone Equipo 9.");
    expect(tramos[3].texto).toBe("Y 1 discrepancia más.");
  });

  it("deja entera una frase que no enumera casos", () => {
    const texto = "7 columnas de la Base de control tienen datos pero se quedaron sin nombre.";
    expect(tramosDeControl(texto)).toEqual([{ codigo: "", texto }]);
  });

  it("no tabula un caso suelto", () => {
    const texto = "CH 31: 25 asistentes menos 1 rechazos dan 24.";
    expect(tramosDeControl(texto)).toHaveLength(1);
  });
});
