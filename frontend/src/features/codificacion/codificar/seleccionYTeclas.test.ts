import { describe, expect, test } from "vitest";
import {
  SELECCION_VACIA,
  modoDeClic,
  moverCursor,
  reconciliarSeleccion,
  respuestasLevantadas,
  seleccionar,
  seleccionarTodo,
  seleccionTrasAsignar,
  soltarSeleccion,
} from "./seleccionRespuestas";
import { intencionDeLista, resolverCodigoTecleado, type TeclaDeLista } from "./teclasDeCodificar";

const orden = ["a", "b", "c", "d", "e"];

describe("selección de respuestas", () => {
  test("un clic elige solo esa respuesta y la deja de ancla", () => {
    const s = seleccionar(seleccionar(SELECCION_VACIA, "b", "unica", orden), "d", "unica", orden);
    expect(s).toEqual({ claves: ["d"], ancla: "d", cursor: "d" });
  });

  test("Mayús y clic elige el tramo entre el ancla y la respuesta, en el orden de la lista y hacia los dos lados", () => {
    const desdeB = seleccionar(SELECCION_VACIA, "b", "unica", orden);
    expect(seleccionar(desdeB, "d", "rango", orden).claves).toEqual(["b", "c", "d"]);
    const desdeD = seleccionar(SELECCION_VACIA, "d", "unica", orden);
    expect(seleccionar(desdeD, "a", "rango", orden)).toEqual({ claves: ["a", "b", "c", "d"], ancla: "d", cursor: "a" });
  });

  test("Cmd o Ctrl y clic suma o quita sin tocar lo demás, y el resultado queda en el orden de la lista", () => {
    let s = seleccionar(SELECCION_VACIA, "d", "unica", orden);
    s = seleccionar(s, "a", "alternar", orden);
    expect(s.claves).toEqual(["a", "d"]);
    s = seleccionar(s, "d", "alternar", orden);
    expect(s.claves).toEqual(["a"]);
  });

  test("las teclas de un clic: Mayús manda sobre Cmd o Ctrl", () => {
    expect(modoDeClic({ shiftKey: true, metaKey: true, ctrlKey: false })).toBe("rango");
    expect(modoDeClic({ shiftKey: false, metaKey: false, ctrlKey: true })).toBe("alternar");
    expect(modoDeClic({ shiftKey: false, metaKey: false, ctrlKey: false })).toBe("unica");
  });

  test("las flechas mueven la selección; con Mayús la extienden desde el ancla; en los extremos se queda", () => {
    const b = seleccionar(SELECCION_VACIA, "b", "unica", orden);
    expect(moverCursor(b, 1, orden, false).claves).toEqual(["c"]);
    expect(moverCursor(moverCursor(b, 1, orden, true), 1, orden, true).claves).toEqual(["b", "c", "d"]);
    expect(moverCursor(seleccionar(SELECCION_VACIA, "e", "unica", orden), 1, orden, false).claves).toEqual(["e"]);
    expect(moverCursor(SELECCION_VACIA, -1, orden, false).claves).toEqual(["e"]);
  });

  test("lo que ya no está en la lista se olvida; sin cambios devuelve el mismo objeto", () => {
    const s = seleccionarTodo(orden);
    expect(reconciliarSeleccion(s, orden)).toBe(s);
    expect(reconciliarSeleccion(s, ["b", "e"]).claves).toEqual(["b", "e"]);
  });

  test("arrastrar una respuesta elegida lleva toda la selección; una no elegida va sola", () => {
    const s = seleccionar(seleccionar(SELECCION_VACIA, "a", "unica", orden), "c", "rango", orden);
    expect(respuestasLevantadas(s, "b")).toEqual(["a", "b", "c"]);
    expect(respuestasLevantadas(s, "e")).toEqual(["e"]);
  });

  test("tras asignar, la selección pasa a la siguiente sin código; sin ninguna, se suelta", () => {
    const conCodigo = new Set(["a", "b", "c"]);
    expect(seleccionTrasAsignar(["b", "c"], orden, (k) => conCodigo.has(k)).claves).toEqual(["d"]);
    const todas = new Set(orden);
    expect(seleccionTrasAsignar(["e"], orden, (k) => todas.has(k))).toEqual({ claves: [], ancla: "e", cursor: "e" });
  });

  test("soltar la selección deja el cursor donde estaba", () => {
    expect(soltarSeleccion(seleccionar(SELECCION_VACIA, "c", "unica", orden))).toEqual({ claves: [], ancla: "c", cursor: "c" });
  });
});

const codigos = [
  { id: "g1", codigo: "1" },
  { id: "g2", codigo: "2" },
  { id: "g12", codigo: "12" },
  { id: "g96", codigo: "96" },
];

describe("el número de un código", () => {
  test("una cifra que no empieza otro código se asigna de inmediato", () => {
    expect(resolverCodigoTecleado("2", codigos)).toEqual({ tipo: "asignar", grupoId: "g2" });
  });

  test("el 1 espera la segunda cifra porque existe el 12; Enter o la espera vencida lo asignan", () => {
    expect(resolverCodigoTecleado("1", codigos)).toEqual({ tipo: "esperar", grupoId: "g1" });
    expect(resolverCodigoTecleado("1", codigos, true)).toEqual({ tipo: "asignar", grupoId: "g1" });
    expect(resolverCodigoTecleado("12", codigos)).toEqual({ tipo: "asignar", grupoId: "g12" });
  });

  test("un 9 solo espera al 96, pero confirmado no asigna nada porque no hay código 9", () => {
    expect(resolverCodigoTecleado("9", codigos)).toEqual({ tipo: "esperar", grupoId: null });
    expect(resolverCodigoTecleado("9", codigos, true)).toEqual({ tipo: "ninguno" });
  });

  test("un número que ningún código lleva no hace nada; los ceros a la izquierda no cuentan", () => {
    expect(resolverCodigoTecleado("7", codigos)).toEqual({ tipo: "ninguno" });
    expect(resolverCodigoTecleado("02", codigos)).toEqual({ tipo: "asignar", grupoId: "g2" });
  });
});

const tecla = (key: string, extra: Partial<TeclaDeLista> = {}): TeclaDeLista => ({ key, code: "", shiftKey: false, altKey: false, modificador: false, ...extra });

describe("qué pide cada tecla en la lista", () => {
  test("una cifra solo cuenta con respuestas elegidas; Mayús la suma sin soltar la selección", () => {
    expect(intencionDeLista(tecla("3", { code: "Digit3" }), { cifras: "", seleccionadas: 0 })).toBeNull();
    expect(intencionDeLista(tecla("3", { code: "Digit3" }), { cifras: "", seleccionadas: 2 })).toEqual({ tipo: "cifra", cifra: "3", quedarse: false });
    // Con Mayús el carácter cambia ("#" en un teclado de EE. UU.); manda la tecla física.
    expect(intencionDeLista(tecla("#", { code: "Digit3", shiftKey: true }), { cifras: "", seleccionadas: 2 })).toEqual({ tipo: "cifra", cifra: "3", quedarse: true });
  });

  test("Supr y Retroceso quitan el código; Retroceso con cifras a medias borra las cifras", () => {
    expect(intencionDeLista(tecla("Delete"), { cifras: "", seleccionadas: 1 })).toEqual({ tipo: "quitar-codigo" });
    expect(intencionDeLista(tecla("Backspace"), { cifras: "", seleccionadas: 1 })).toEqual({ tipo: "quitar-codigo" });
    expect(intencionDeLista(tecla("Backspace"), { cifras: "1", seleccionadas: 1 })).toEqual({ tipo: "descartar-cifras" });
    expect(intencionDeLista(tecla("Delete", { repeat: true }), { cifras: "", seleccionadas: 1 })).toBeNull();
  });

  test("flechas, Inicio y Fin mueven; Enter confirma las cifras o abre la lista de códigos; Cmd o Ctrl y A elige todo", () => {
    expect(intencionDeLista(tecla("ArrowDown", { shiftKey: true }), { cifras: "", seleccionadas: 0 })).toEqual({ tipo: "mover", destino: 1, extender: true });
    expect(intencionDeLista(tecla("End"), { cifras: "", seleccionadas: 0 })).toEqual({ tipo: "mover", destino: "fin", extender: false });
    expect(intencionDeLista(tecla("Enter"), { cifras: "1", seleccionadas: 1 })).toEqual({ tipo: "confirmar-cifras" });
    expect(intencionDeLista(tecla("Enter"), { cifras: "", seleccionadas: 1 })).toEqual({ tipo: "abrir-lista" });
    expect(intencionDeLista(tecla("a", { modificador: true }), { cifras: "", seleccionadas: 0 })).toEqual({ tipo: "todo" });
    expect(intencionDeLista(tecla("z", { modificador: true }), { cifras: "", seleccionadas: 1 })).toBeNull();
  });
});

describe("alternarVarias (casillas de la tabla)", () => {
  test("las elegidas salen, las demás entran y todo queda en el orden de la lista", async () => {
    const { alternarVarias, SELECCION_VACIA: vacia } = await import("./seleccionRespuestas");
    const orden = ["a", "b", "c", "d"];
    const una = alternarVarias(vacia, ["c", "a"], orden);
    expect(una.claves).toEqual(["a", "c"]);
    expect(alternarVarias(una, ["a", "b"], orden).claves).toEqual(["b", "c"]);
    expect(alternarVarias(una, ["x"], orden)).toBe(una);
  });
});
