// Mata: listar preguntas de otra sección, la propia fila de la sección o las de una subsección como si fueran directas.
import { describe, expect, it } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { elementosDeSeccion, numerosDePregunta } from "./ContenidoSeccion";

const survey = {
  columns: ["type", "name", "label"],
  rows: [
    ["begin_group", "g1", "Datos"],
    ["integer", "edad", "Edad"],
    ["begin_group", "g1b", "Contacto"],
    ["text", "correo", "Correo"],
    ["end_group", "", ""],
    ["text", "nombre", "Nombre"],
    ["end_group", "", ""],
    ["begin_group", "g2", "Otra"],
    ["text", "otra", "Otra"],
    ["end_group", "", ""],
  ],
};

describe("contenido de una sección en la vista de trabajo", () => {
  it("lista sólo los elementos directos; la subsección cuenta como uno", () => {
    const s = parseBuilderStructure(survey);
    expect(elementosDeSeccion(s, 0).map((n) => n.name)).toEqual(["edad", "g1b", "nombre"]);
  });
  it("numera las preguntas en todo el formulario, no dentro de cada sección", () => {
    const s = parseBuilderStructure(survey);
    const num = numerosDePregunta(s);
    expect(elementosDeSeccion(s, 7).map((n) => num.get(n.rowIndex))).toEqual(["4"]);
  });
});
