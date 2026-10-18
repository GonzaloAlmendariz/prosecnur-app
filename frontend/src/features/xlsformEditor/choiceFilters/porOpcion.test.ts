// C27: el filtro por opción del hostigamiento (Tipo 2). Mata: leer la forma original como cascada o como técnica,
// perder la opción fija `name = '0'`, escribir una fila por opción cuando la habilitan varias respuestas (XLSForm las
// pide repetidas) y tocar filas de otras listas.
import { describe, expect, it } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { aplicarPorOpcion, asignacionesPorOpcion, expresionPorOpcion, leerPorOpcion, opcionesDeLista } from "./porOpcion";

const EXPR = "filter_P14=${P14} or filter_P15=${P15} or name = '0'";

function libro(): XlsformEditorWorkbook {
  return {
    survey: {
      columns: ["type", "name", "label", "choice_filter"],
      rows: [
        ["select_one frecuencia", "P14", "¿Te dijeron frases para humillarte?", ""],
        ["select_one frecuencia", "P15", "¿Te tocaron sin tu consentimiento?", ""],
        ["select_one expresion", "P21", "¿Cuál fue la más grave?", EXPR],
      ],
    },
    choices: {
      columns: ["list_name", "name", "label", "filter_P14", "filter_P15"],
      rows: [
        ["frecuencia", "1", "Nunca", "", ""],
        ["frecuencia", "2", "Una vez", "", ""],
        ["frecuencia", "3", "Varias veces", "", ""],
        ["expresion", "1", "Frases para humillar", "2", ""],
        ["expresion", "1", "Frases para humillar", "3", ""],
        ["expresion", "2", "Tocamientos", "", "2"],
        ["expresion", "0", "Ninguna de las anteriores", "", ""],
        ["otra", "a", "Otra lista", "9", ""],
      ],
    },
    settings: { columns: ["form_title"], rows: [["Hostigamiento"]] },
  };
}

describe("filtro por opción", () => {
  it("lee la forma del Tipo 2 y no confunde una cascada simple", () => {
    expect(leerPorOpcion(EXPR)).toEqual({
      terminos: [{ columna: "filter_P14", pregunta: "P14" }, { columna: "filter_P15", pregunta: "P15" }],
      siempre: ["0"],
    });
    expect(leerPorOpcion("filtro_region=${region}")).toBeNull();
    expect(leerPorOpcion("${Country} = 'PER' and (name = '1' or name = '2')")).toBeNull();
  });

  it("junta las filas repetidas de una opción en sus respuestas", () => {
    const wb = libro();
    const a = asignacionesPorOpcion(wb.choices, "expresion", leerPorOpcion(EXPR)!);
    expect(opcionesDeLista(wb.choices, "expresion")).toEqual(["1", "2", "0"]);
    expect(a["1"]).toEqual({ pregunta: "P14", valores: ["2", "3"] });
    expect(a["2"]).toEqual({ pregunta: "P15", valores: ["2"] });
    expect(a["0"]).toEqual({ pregunta: "", valores: [] });
  });

  it("arma la expresión con las preguntas en el orden de las opciones y las fijas al final", () => {
    expect(expresionPorOpcion(["1", "2", "0"], { "1": { pregunta: "P15", valores: ["2"] }, "2": { pregunta: "P14", valores: ["3"] }, "0": { pregunta: "", valores: [] } }, null))
      .toBe("filter_P15=${P15} or filter_P14=${P14} or name = '0'");
  });

  it("escribe una fila por respuesta, limpia lo viejo y no toca otras listas", () => {
    const wb = libro();
    const previa = leerPorOpcion(EXPR)!;
    const out = aplicarPorOpcion(wb, 2, "expresion", {
      "1": { pregunta: "P14", valores: ["2", "3"] },
      "2": { pregunta: "P15", valores: ["2", "3"] },
      "0": { pregunta: "", valores: [] },
    }, previa);
    const filas = out.choices.rows.filter((r) => r[0] === "expresion").map((r) => r.slice(1, 5).join("|"));
    expect(filas).toEqual([
      "1|Frases para humillar|2|",
      "1|Frases para humillar|3|",
      "2|Tocamientos||2",
      "2|Tocamientos||3",
      "0|Ninguna de las anteriores||",
    ]);
    expect(out.choices.rows.find((r) => r[0] === "otra")).toEqual(["otra", "a", "Otra lista", "9", ""]);
    expect(out.choices.rows.findIndex((r) => r[0] === "expresion")).toBe(3);
    expect(out.survey.rows[2][3]).toBe(EXPR);
    const iA = out.settings.columns.indexOf("allow_choice_duplicates");
    expect(out.settings.rows[0][iA]).toBe("yes");
  });

  it("una pregunta nueva crea su columna; sin repetidas no toca settings", () => {
    const wb = libro();
    const out = aplicarPorOpcion(wb, 2, "expresion", {
      "1": { pregunta: "P14", valores: ["2"] },
      "2": { pregunta: "P99", valores: ["1"] },
      "0": { pregunta: "", valores: [] },
    }, leerPorOpcion(EXPR));
    expect(out.choices.columns).toContain("filter_P99");
    expect(out.survey.rows[2][3]).toBe("filter_P14=${P14} or filter_P99=${P99} or name = '0'");
    expect(out.settings).toBe(wb.settings);
  });
});
