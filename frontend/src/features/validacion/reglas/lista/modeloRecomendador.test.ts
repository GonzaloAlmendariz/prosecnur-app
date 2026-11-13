// Ítem 40: la frase del motor partida en texto, códigos y fichas de valores.
import { expect, test } from "vitest";
import type { ExploradorVariablesList, ReglaSemilla } from "../../types";
import { indiceDePreguntas, piezasDeFrase, presentarSugerida } from "./modeloRecomendador";

const INVENTARIO = {
  ok: true,
  base_nombre: null,
  n_variables: 2,
  secciones: [{ nombre: "s", variables: [
    { name: "ubigeo", label: "Ubigeo del distrito", tipo: "texto", n_validos: 1, n_nulos: 0 },
    { name: "hora_fin_h", label: "hora_fin_h", tipo: "texto", n_validos: 1, n_nulos: 0 },
  ] }],
} as unknown as ExploradorVariablesList;

test("el índice ignora la etiqueta que repite el nombre", () => {
  const indice = indiceDePreguntas(INVENTARIO);
  expect(indice.get("ubigeo")?.etiqueta).toBe("Ubigeo del distrito");
  expect(indice.get("hora_fin_h")?.etiqueta).toBeNull();
});

test("valores seguidos se juntan en una pieza y pierden el paréntesis que los envolvía", () => {
  const piezas = piezasDeFrase('3 valores de cod no siguen la forma de los demás ("A1", "B2" y "C3"); el resto se escribe como "P375".', ["cod"]);
  expect(piezas).toEqual([
    { tipo: "texto", texto: "3 valores de " },
    { tipo: "codigo", texto: "cod" },
    { tipo: "texto", texto: " no siguen la forma de los demás " },
    { tipo: "valores", valores: ["A1", "B2", "C3"] },
    { tipo: "texto", texto: "; el resto se escribe como " },
    { tipo: "valores", valores: ["P375"] },
    { tipo: "texto", texto: "." },
  ]);
});

test("la etiqueta sin comillas del inventario también se cambia por el código", () => {
  const semilla = {
    tipo: "formato", variables: ["ubigeo"], params: {}, nombre: "Ubigeo del distrito (ubigeo) con 6 dígitos",
    mensaje: "", severidad: "error", activa: true,
    semilla: { origen: "formulario_digitos", porque: "El formulario pide un número de 6 dígitos.", n_casos_hoy: 3 },
  } as unknown as ReglaSemilla;
  const vista = presentarSugerida(semilla, indiceDePreguntas(INVENTARIO));
  expect(vista.titulo).toEqual([{ tipo: "codigo", texto: "ubigeo" }, { tipo: "texto", texto: " con 6 dígitos" }]);
  expect(vista.pregunta).toEqual({ codigo: "ubigeo", etiqueta: "Ubigeo del distrito", tipo: "texto" });
  expect(vista.casosHoy).toBe(3);
});

test("con la ficha de la pregunta debajo, el título no repite su código al final", () => {
  const semilla = {
    tipo: "fuera_catalogo", variables: ["p6"], params: {}, nombre: "Fuera de la lista de opciones: \u00abParticipa\u00bb (p6)",
    mensaje: "", severidad: "error", activa: true,
    semilla: { origen: "dominio", porque: "\u00abParticipa\u00bb (p6) registra \u00ab77\u00bb." },
  } as unknown as ReglaSemilla;
  const vista = presentarSugerida(semilla);
  expect(vista.titulo).toEqual([{ tipo: "texto", texto: "Fuera de la lista de opciones" }]);
  expect(vista.pregunta).toEqual({ codigo: "p6", etiqueta: "Participa", tipo: "texto" });
  expect(vista.porque[0]).toEqual({ tipo: "codigo", texto: "p6" });
});
