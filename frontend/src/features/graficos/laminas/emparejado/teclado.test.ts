// @vitest-environment happy-dom
// El teclado de «Revisar emparejado» (X6): qué tecla hace qué y cuándo no es suya.
import { describe, expect, it } from "vitest";
import { accionDeTecla, ATAJO, esCampo, filaVecina } from "./teclado";

const tecla = (key: string, extra: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean; isComposing: boolean }> = {}) =>
  ({ key, altKey: false, ctrlKey: false, metaKey: false, ...extra });

function el(html: string, sel: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  const e = host.querySelector(sel);
  if (!e) throw new Error(sel);
  return e;
}

describe("accionDeTecla", () => {
  const ancla = el("<span tabindex='-1' data-emp-fila='a'></span>", "span");
  it("J, K y X en cualquier mayúscula; Enter fuera de un control", () => {
    expect(["j", "J", "k", "K", "x", "X", "Enter"].map((k) => accionDeTecla(tecla(k), ancla)))
      .toEqual(["siguiente", "siguiente", "anterior", "anterior", "quitar", "quitar", "confirmar"]);
    expect(accionDeTecla(tecla("Enter"), null)).toBe("confirmar");
    expect(accionDeTecla(tecla("a"), ancla)).toBeNull();
  });
  it("con modificadores o componiendo no hace nada", () => {
    expect(accionDeTecla(tecla("j", { metaKey: true }), ancla)).toBeNull();
    expect(accionDeTecla(tecla("x", { ctrlKey: true }), ancla)).toBeNull();
    expect(accionDeTecla(tecla("k", { altKey: true }), ancla)).toBeNull();
    expect(accionDeTecla(tecla("j", { isComposing: true }), ancla)).toBeNull();
  });
  it("Enter sobre un botón o un radio es del control; J y X sí actúan", () => {
    const boton = el("<button>Cambiar</button>", "button");
    expect(accionDeTecla(tecla("Enter"), boton)).toBeNull();
    expect(accionDeTecla(tecla("Enter"), el("<div role='radio'></div>", "div"))).toBeNull();
    expect(accionDeTecla(tecla("j"), boton)).toBe("siguiente");
    expect(accionDeTecla(tecla("x"), boton)).toBe("quitar");
  });
  it("en un campo o en el buscador del par ninguna tecla es suya", () => {
    for (const [html, sel] of [
      ["<input>", "input"], ["<textarea></textarea>", "textarea"], ["<div contenteditable='true'><b>x</b></div>", "b"],
      ["<ul role='listbox'><li role='option'>q2</li></ul>", "li"], ["<span class='pulso-f6-emp-buscar'><button>x</button></span>", "button"],
    ] as const) {
      const e = el(html, sel);
      expect(esCampo(e)).toBe(true);
      expect(["j", "k", "x", "Enter"].map((k) => accionDeTecla(tecla(k), e))).toEqual([null, null, null, null]);
    }
  });
  it("las teclas que se muestran en los globos", () => {
    expect(ATAJO).toEqual({ siguiente: "J", anterior: "K", confirmar: "Enter", quitar: "X" });
  });
});

describe("filaVecina", () => {
  const c = ["a", "b", "c"];
  it("J baja, K sube y se detiene en los bordes", () => {
    expect(filaVecina(c, "a", 1)).toBe("b");
    expect(filaVecina(c, "c", 1)).toBe("c");
    expect(filaVecina(c, "b", -1)).toBe("a");
    expect(filaVecina(c, "a", -1)).toBe("a");
  });
  it("sin fila activa (o con una que el filtro escondió) J va a la primera y K a la última", () => {
    expect(filaVecina(c, null, 1)).toBe("a");
    expect(filaVecina(c, "z", -1)).toBe("c");
    expect(filaVecina([], null, 1)).toBeNull();
  });
});
