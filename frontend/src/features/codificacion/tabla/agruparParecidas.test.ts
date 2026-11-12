// "Agrupar parecidas" en la tabla de Codificar (prototipo, vista de tabla): junta en una fila los textos que
// se escriben casi igual y los lista debajo. Usa la misma medida de parecido que "Parecidas" de la tarjeta.
import { describe, expect, test } from "vitest";
import { agruparParecidas, PARECIDO_PARA_AGRUPAR } from "./agruparParecidas";
import type { CodigoTabla, FilaTabla } from "./tablaCodificarModelo";

const codigo = (id: string): CodigoTabla => ({ id, codigo: id, nombre: id, rotulo: id, acento: "", casos: 0 });
const fila = (clave: string, veces: number, codigos: CodigoTabla[] = [], noResponde = false): FilaTabla => ({
  clave, texto: clave, titulo: clave, veces, variantes: 1, codigos, noResponde,
});

describe("agruparParecidas", () => {
  test("junta bajo la primera los textos casi iguales, suma sus veces y los lista debajo", () => {
    const filas = [fila("iglesia catolica", 5), fila("mercado", 4), fila("iglesia catolicas", 2), fila("iglesia catolca", 1)];
    const [primera, segunda] = agruparParecidas(filas);
    expect(primera.clave).toBe("iglesia catolica");
    expect(primera.veces).toBe(8);
    expect(primera.miembros?.map((m) => m.clave)).toEqual(["iglesia catolicas", "iglesia catolca"]);
    expect(segunda.clave).toBe("mercado");
    expect(segunda.miembros).toBeUndefined();
  });

  test("no junta textos distintos ni filas con códigos distintos ni no respuestas con respuestas", () => {
    const uno = codigo("1");
    const filas = [fila("en el barrio", 3, [uno]), fila("en el barrios", 1), fila("colas largas", 2), fila("menos colas en ventanilla", 1)];
    const r = agruparParecidas(filas);
    expect(r.map((f) => f.clave)).toEqual(["en el barrio", "en el barrios", "colas largas", "menos colas en ventanilla"]);
    expect(agruparParecidas([fila("no", 3, [], true), fila("noo", 1)]).map((f) => f.clave)).toEqual(["no", "noo"]);
  });

  test("el umbral es estricto: solo variantes de escritura, no textos que tratan de lo mismo", () => {
    expect(PARECIDO_PARA_AGRUPAR).toBeGreaterThanOrEqual(0.8);
  });

  test("sin filas parecidas devuelve las mismas filas", () => {
    const filas = [fila("radio", 1), fila("television", 1)];
    expect(agruparParecidas(filas)).toEqual(filas);
  });
});
