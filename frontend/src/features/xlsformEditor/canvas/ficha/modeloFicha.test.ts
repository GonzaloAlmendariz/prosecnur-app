// Modelo de la ficha. Mata: elegir una apariencia que borra los tokens que la ficha no maneja, una variante importada
// (`horizontal`) que no se reconoce como «En una fila», un cambio de tipo que no avisa que la lista queda sin uso y un
// conteo de referencias que no coincide con lo que reescribe el renombre.
import { describe, expect, test } from "vitest";
import { aparienciaActiva, aparienciaAjena, aparienciasDe, conApariencia, contarReferencias, focoParaPestana, listaQueSePierde } from "./modeloFicha";

describe("apariencia en la plataforma", () => {
  test("cada tipo ofrece sus opciones; uno sin variantes, ninguna", () => {
    expect(aparienciasDe("select_one")?.map((o) => o.nombre)).toEqual(["Lista", "Desplegable", "En una fila", "Con buscador"]);
    expect(aparienciasDe("begin_repeat")?.length).toBe(2);
    expect(aparienciasDe("integer")).toBeNull();
  });
  test("reconoce variantes importadas", () => {
    expect(aparienciaActiva("select_one", "horizontal-compact")).toBe("columns-pack");
    expect(aparienciaActiva("select_one", "")).toBe("");
    expect(aparienciaActiva("text", "multiline")).toBe("multiline");
  });
  test("elegir otra conserva lo que la ficha no maneja", () => {
    expect(conApariencia("select_one", "minimal quick", "autocomplete")).toBe("quick autocomplete");
    expect(conApariencia("select_one", "minimal likert", "")).toBe("likert");
    expect(aparienciaAjena("select_one", "minimal likert")).toEqual(["likert"]);
  });
});

describe("cambiar el tipo y renombrar", () => {
  const nodo = { typeInfo: { raw: "select_one si_no", base: "select_one", listName: "si_no" } };
  test("dejar de ser selección pierde la lista", () => {
    expect(listaQueSePierde(nodo, "text", 1)).toEqual({ lista: "si_no", quedaSinUso: true });
    expect(listaQueSePierde(nodo, "text", 3)).toEqual({ lista: "si_no", quedaSinUso: false });
    expect(listaQueSePierde(nodo, "select_multiple", 1)).toBeNull();
  });
  test("cuenta las celdas que citan el código", () => {
    const survey = { name: "survey", columns: ["type", "name", "relevant", "label"], rows: [["integer", "edad", "", ""], ["text", "b", "${edad} > 18 and ${edad} < 60", "Tienes ${edad}"]] };
    expect(contarReferencias(survey, "edad")).toBe(2);
    expect(contarReferencias(survey, "nadie")).toBe(0);
  });
  test("la Lógica abre una sección por su fila", () => {
    expect(focoParaPestana("logica", { kind: "section", name: "s", rowIndex: 4 })).toBe("seccion:4");
    expect(focoParaPestana("restricciones", { kind: "question", name: "edad", rowIndex: 2 })).toBe("edad");
  });
});
