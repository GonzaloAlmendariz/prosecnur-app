import { describe, expect, test } from "vitest";
import type { BuilderNode } from "../types";
import type { SeccionDoc } from "./modeloCuestionario";
import { buscarEnCuestionario } from "./buscarEnCuestionario";

const preg = (name: string, label: string, numero: number) => ({
  tipo: "pregunta" as const,
  pregunta: { nodo: { name, label } as BuilderNode, numero, forma: "texto" as const, opciones: [], condicion: null, rango: null },
});
const sec = (clave: string, rotulo: string, bloques: SeccionDoc["bloques"]): SeccionDoc => ({
  clave, name: clave, rotulo, fila: 1, sinTitulo: false, repite: false, preguntas: bloques.length, segundos: 0, conCondicion: 0, bloques,
});
const doc = [sec("s1", "Datos del hogar", [preg("HH01", "Nombre del **jefe**", 1)]), sec("s6", "S6: Discapacidad", [preg("DIS01a", "¿Tiene dificultad?", 2)])];

describe("buscador del índice", () => {
  test("vacío no filtra", () => expect(buscarEnCuestionario(doc, "  ")).toBeNull());
  test("casa título de sección sin tildes", () => expect([...buscarEnCuestionario(doc, "discapacidad")!.secciones]).toEqual(["s6"]));
  test("casa pregunta por código o texto y trae su sección", () => {
    const r = buscarEnCuestionario(doc, "hh01")!;
    expect([...r.secciones]).toEqual(["s1"]);
    expect(r.preguntas).toEqual([{ seccion: "s1", name: "HH01", numero: 1, texto: "Nombre del jefe" }]);
    expect(buscarEnCuestionario(doc, "jefe")!.preguntas).toHaveLength(1);
  });
});
