// Un código que guarda el texto tal cual cuenta como asignado a la respuesta de la lista que tiene su misma
// forma normalizada, como en el motor. Caso medido en el proyecto sintético (comentario_open): la ficha decía
// "Codificada", Aplicar contaba 72 respuestas con código y Codificar decía "0 de 3".
import { describe, expect, test } from "vitest";
import type { Grupo } from "../../../api/codificacion";
import { avanceDeRespuestas } from "../avanceRespuestas";
import { alinearClavesConRespuestas, idsUnicos } from "./clavesDeGrupo";

const RESPUESTAS = [
  { texto_normalizado: "necesita seguimiento y comunicacion mas clara." },
  { texto_normalizado: "todo bien" },
  { texto_normalizado: "mejorar el horario" },
];

const GRUPOS: Grupo[] = [
  { id: "g1", codigo: "101", etiqueta: "Comunicación", origen: "nuevo", respuestas: ["Necesita seguimiento y comunicacion mas clara.", "  Todo   bien "] },
  { id: "g2", codigo: "102", etiqueta: "Horario", origen: "nuevo", respuestas: ["Mejorar el horario", "Un texto que la base ya no trae"] },
];

describe("alinearClavesConRespuestas", () => {
  test("sin alinear, el avance no ve los textos guardados tal cual (el defecto)", () => {
    expect(avanceDeRespuestas(RESPUESTAS, GRUPOS).codificadas).toBe(0);
  });

  test("alineadas, las tres respuestas cuentan con código y la que ya no está queda como tal", () => {
    const alineados = alinearClavesConRespuestas(GRUPOS, RESPUESTAS);
    expect(alineados[0].respuestas).toEqual(["necesita seguimiento y comunicacion mas clara.", "todo bien"]);
    expect(alineados[1].respuestas).toEqual(["mejorar el horario", "Un texto que la base ya no trae"]);
    const avance = avanceDeRespuestas(RESPUESTAS, alineados);
    expect(avance).toEqual({ codificadas: 3, pendientes: 0, total: 3, huerfanas: 1 });
  });

  test("tildes y comillas se comparan como en el motor", () => {
    const [g] = alinearClavesConRespuestas(
      [{ id: "g", codigo: "1", etiqueta: "x", respuestas: ["Comunicación \"más\" clara"] }],
      [{ texto_normalizado: "comunicacion mas clara" }],
    );
    expect(g.respuestas).toEqual(["comunicacion mas clara"]);
  });

  test("dos guardadas que normalizan igual quedan en una sola clave", () => {
    const [g] = alinearClavesConRespuestas(
      [{ id: "g", codigo: "1", etiqueta: "x", respuestas: ["Todo bien", "todo bien", "TODO BIEN"] }],
      [{ texto_normalizado: "todo bien" }],
    );
    expect(g.respuestas).toEqual(["todo bien"]);
  });

  test("un código que ya guarda las claves de la lista no cambia de identidad", () => {
    const grupo: Grupo = { id: "g", codigo: "1", etiqueta: "x", respuestas: ["todo bien"] };
    expect(alinearClavesConRespuestas([grupo], [{ texto_normalizado: "todo bien" }])[0]).toBe(grupo);
  });
});

describe("idsUnicos", () => {
  test("dos códigos con el mismo id quedan con ids distintos; el primero conserva el suyo", () => {
    const lista = idsUnicos([
      { id: "g", codigo: "101", etiqueta: "a", respuestas: [] },
      { id: "g", codigo: "102", etiqueta: "b", respuestas: [] },
    ]);
    expect(lista.map((x) => x.id)).toEqual(["g", "g_1"]);
    expect(new Set(lista.map((x) => x.id)).size).toBe(2);
  });
});

describe("idsUnicos con códigos guardados sin id (proyecto sintético)", () => {
  test("cada uno recibe un id distinto a partir de su número", () => {
    const sinId = [
      { codigo: "101", etiqueta: "a", respuestas: [] },
      { codigo: "102", etiqueta: "b", respuestas: [] },
    ] as unknown as Grupo[];
    expect(idsUnicos(sinId).map((g) => g.id)).toEqual(["g_101", "g_102"]);
  });
});
