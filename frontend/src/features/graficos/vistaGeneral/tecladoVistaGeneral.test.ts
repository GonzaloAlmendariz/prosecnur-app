import { describe, expect, it } from "vitest";
import { desplazamientosFlip, tarjetasNuevas } from "./flip";
import { destinoDeFoco, intencionDeTecla, type TeclaVistaGeneral } from "./tecladoVistaGeneral";

const t = (key: string, mods: Partial<Omit<TeclaVistaGeneral, "key">> = {}): TeclaVistaGeneral => ({
  key, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...mods,
});

describe("teclado de la Vista general", () => {
  // Mata: confundir Alt+flecha (mover) con flecha (navegar), o invertir la dirección.
  it("Alt+flechas mueven; las flechas solas navegan", () => {
    expect(intencionDeTecla(t("ArrowUp", { altKey: true }))).toEqual({ tipo: "mover", dir: -1 });
    expect(intencionDeTecla(t("ArrowLeft", { altKey: true }))).toEqual({ tipo: "mover", dir: -1 });
    expect(intencionDeTecla(t("ArrowDown", { altKey: true }))).toEqual({ tipo: "mover", dir: 1 });
    expect(intencionDeTecla(t("ArrowRight"))).toEqual({ tipo: "ir", destino: "siguiente", extender: false });
    expect(intencionDeTecla(t("ArrowLeft", { shiftKey: true }))).toEqual({ tipo: "ir", destino: "anterior", extender: true });
  });

  // Mata: Supr que elimina sin pasar por la confirmación (intención distinta), Enter que no abre, Cmd en Mac ignorado.
  it("Enter abre, Supr y Retroceso piden eliminar, Ctrl/Cmd+D duplica y Ctrl/Cmd+A elige todo", () => {
    expect(intencionDeTecla(t("Enter"))).toEqual({ tipo: "abrir" });
    expect(intencionDeTecla(t("Delete"))).toEqual({ tipo: "eliminar" });
    expect(intencionDeTecla(t("Backspace"))).toEqual({ tipo: "eliminar" });
    expect(intencionDeTecla(t("d", { metaKey: true }))).toEqual({ tipo: "duplicar" });
    expect(intencionDeTecla(t("D", { ctrlKey: true }))).toEqual({ tipo: "duplicar" });
    expect(intencionDeTecla(t("a", { ctrlKey: true }))).toEqual({ tipo: "todo" });
    expect(intencionDeTecla(t(" "))).toEqual({ tipo: "alternar" });
    expect(intencionDeTecla(t("Escape"))).toEqual({ tipo: "vaciar" });
  });

  // Mata: robar Ctrl/Cmd+Z (deshacer global) o letras sueltas.
  it("deja pasar lo que no es suyo", () => {
    expect(intencionDeTecla(t("z", { metaKey: true }))).toBeNull();
    expect(intencionDeTecla(t("j"))).toBeNull();
    expect(intencionDeTecla(t("ArrowUp", { altKey: true, ctrlKey: true }))).toBeNull();
  });

  // Mata: salirse del informe en los bordes, o que ↑/↓ no salten de capítulo (o caigan en una fila vacía).
  it("el foco itinerante recorre el plan y salta de capítulo con ↑/↓", () => {
    const filas = [["a", "b"], [], ["c", "d", "e"], ["f"]];
    expect(destinoDeFoco(filas, "b", "siguiente")).toBe("c");
    expect(destinoDeFoco(filas, "a", "anterior")).toBe("a");
    expect(destinoDeFoco(filas, "f", "siguiente")).toBe("f");
    expect(destinoDeFoco(filas, "b", "fila-siguiente")).toBe("c");
    expect(destinoDeFoco(filas, "e", "fila-anterior")).toBe("a");
    expect(destinoDeFoco(filas, "a", "fila-anterior")).toBe("a");
    expect(destinoDeFoco(filas, "d", "ultima")).toBe("f");
    expect(destinoDeFoco(filas, null, "siguiente")).toBe("a");
    expect(destinoDeFoco([], "a", "siguiente")).toBeNull();
  });
});

describe("FLIP al reordenar", () => {
  // Mata: animar con el signo invertido (la tarjeta saldría hacia el lado contrario) o animar lo que no se movió.
  it("cada tarjeta parte de su sitio viejo; lo quieto o recién llegado no se anima", () => {
    const antes = new Map([["a", { x: 0, y: 0 }], ["b", { x: 200, y: 0 }], ["c", { x: 400, y: 0 }]]);
    const despues = new Map([["a", { x: 200, y: 0 }], ["b", { x: 0, y: 0 }], ["c", { x: 400.2, y: 0 }], ["n", { x: 0, y: 99 }]]);
    expect(desplazamientosFlip(antes, despues)).toEqual([
      { id: "a", dx: -200, dy: 0 },
      { id: "b", dx: 200, dy: 0 },
    ]);
    expect(desplazamientosFlip(antes, new Map([["a", { x: 5000, y: 0 }]]))).toEqual([]);
  });
});

// I8 (2026-10-14). Mata: animar el informe entero al cargarlo o al cambiar de base, o no animar la copia recién hecha.
describe("tarjetas que aparecen", () => {
  const p = (ids: string[]) => new Map(ids.map((id, i) => [id, { x: i * 10, y: 0 }]));
  it("sólo las pocas que el usuario acaba de crear", () => {
    expect(tarjetasNuevas(p(["a", "b", "c"]), p(["a", "a2", "b", "c"]))).toEqual(["a2"]);
    expect(tarjetasNuevas(new Map(), p(["a", "b"]))).toEqual([]);
    expect(tarjetasNuevas(p(["a", "b"]), p(["x", "y", "z"]))).toEqual([]);
  });
});
