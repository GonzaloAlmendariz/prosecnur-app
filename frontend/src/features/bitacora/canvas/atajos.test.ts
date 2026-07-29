import { describe, expect, it } from "vitest";

import { escribiendoEnCampo, resolverAtajo, type ContextoAtajo, type EventoTecla } from "./atajos";

function tecla(key: string, mods: Partial<EventoTecla> = {}): EventoTecla {
  return { key, shiftKey: false, altKey: false, metaKey: false, ctrlKey: false, ...mods };
}

const LIBRE: ContextoAtajo = { editando: false, hayFoco: false, armandoConexion: false };
const CON_FOCO: ContextoAtajo = { ...LIBRE, hayFoco: true };
const EDITANDO: ContextoAtajo = { ...LIBRE, editando: true };

describe("resolverAtajo mientras se escribe", () => {
  it("cede casi todo al textarea", () => {
    // Si el lienzo interceptara las teclas mientras se escribe, no se podría
    // teclear una "n" dentro de un nodo.
    expect(resolverAtajo(tecla("n"), EDITANDO)).toBeNull();
    expect(resolverAtajo(tecla("Delete"), EDITANDO)).toBeNull();
    expect(resolverAtajo(tecla("ArrowLeft"), EDITANDO)).toBeNull();
  });

  it("Escape siempre sale", () => {
    // Sin esa salida, entrar a escribir sería una trampa para quien navega con
    // teclado.
    expect(resolverAtajo(tecla("Escape"), EDITANDO)).toEqual({ tipo: "salir" });
  });
});

describe("deshacer y rehacer", () => {
  it.each([
    [tecla("z", { metaKey: true }), "deshacer"],
    [tecla("z", { ctrlKey: true }), "deshacer"],
    [tecla("z", { metaKey: true, shiftKey: true }), "rehacer"],
    [tecla("y", { ctrlKey: true }), "rehacer"],
  ])("%o => %s", (evento, esperado) => {
    expect(resolverAtajo(evento, CON_FOCO)).toEqual({ tipo: esperado });
  });

  it("z sin modificador no deshace", () => {
    expect(resolverAtajo(tecla("z"), CON_FOCO)).toBeNull();
  });
});

describe("navegación", () => {
  it("Tab recorre en orden de lectura y Shift+Tab al revés", () => {
    expect(resolverAtajo(tecla("Tab"), LIBRE)).toEqual({ tipo: "foco", paso: 1 });
    expect(resolverAtajo(tecla("Tab", { shiftKey: true }), LIBRE)).toEqual({ tipo: "foco", paso: -1 });
  });

  it("las flechas navegan entre nodos", () => {
    expect(resolverAtajo(tecla("ArrowRight"), CON_FOCO)).toEqual({ tipo: "navegar", direccion: "derecha" });
  });

  it("Shift + flecha MUEVE el nodo un paso de grilla", () => {
    expect(resolverAtajo(tecla("ArrowRight", { shiftKey: true }), CON_FOCO)).toEqual({ tipo: "mover", dx: 16, dy: 0 });
    expect(resolverAtajo(tecla("ArrowUp", { shiftKey: true }), CON_FOCO)).toEqual({ tipo: "mover", dx: 0, dy: -16 });
  });

  it("Alt afina el movimiento a un píxel", () => {
    expect(resolverAtajo(tecla("ArrowRight", { shiftKey: true, altKey: true }), CON_FOCO))
      .toEqual({ tipo: "mover", dx: 1, dy: 0 });
  });

  it("sin foco las flechas no hacen nada", () => {
    expect(resolverAtajo(tecla("ArrowRight"), LIBRE)).toBeNull();
  });
});

describe("crear, editar y borrar", () => {
  it("`n` crea incluso sin foco: es la forma de empezar sin ratón", () => {
    expect(resolverAtajo(tecla("n"), LIBRE)).toEqual({ tipo: "nuevo" });
    expect(resolverAtajo(tecla("N"), CON_FOCO)).toEqual({ tipo: "nuevo" });
  });

  it("Enter edita el nodo enfocado", () => {
    expect(resolverAtajo(tecla("Enter"), CON_FOCO)).toEqual({ tipo: "editar" });
    expect(resolverAtajo(tecla("Enter"), LIBRE)).toBeNull();
  });

  it("Supr y Backspace borran", () => {
    expect(resolverAtajo(tecla("Delete"), CON_FOCO)).toEqual({ tipo: "borrar" });
    expect(resolverAtajo(tecla("Backspace"), CON_FOCO)).toEqual({ tipo: "borrar" });
  });

  it("sin foco no se borra nada", () => {
    expect(resolverAtajo(tecla("Delete"), LIBRE)).toBeNull();
  });
});

describe("conectar", () => {
  it("`c` arma la conexión", () => {
    expect(resolverAtajo(tecla("c"), CON_FOCO)).toEqual({ tipo: "conectar", direccion: "derecha" });
  });

  it("con la conexión armada, la flecha elige destino en vez de mover", () => {
    const armado: ContextoAtajo = { ...CON_FOCO, armandoConexion: true };
    expect(resolverAtajo(tecla("ArrowDown"), armado)).toEqual({ tipo: "conectar", direccion: "abajo" });
    // Incluso con Shift, que normalmente movería.
    expect(resolverAtajo(tecla("ArrowDown", { shiftKey: true }), armado))
      .toEqual({ tipo: "conectar", direccion: "abajo" });
  });
});

describe("cámara", () => {
  it("Cmd+0 vuelve al contenido y Cmd+1 al 100%", () => {
    expect(resolverAtajo(tecla("0", { metaKey: true }), LIBRE)).toEqual({ tipo: "ir-a-contenido" });
    expect(resolverAtajo(tecla("1", { metaKey: true }), LIBRE)).toEqual({ tipo: "zoom-100" });
  });

  it("Cmd+A selecciona todo", () => {
    expect(resolverAtajo(tecla("a", { metaKey: true }), LIBRE)).toEqual({ tipo: "seleccionar-todo" });
  });
});

describe("escribiendoEnCampo", () => {
  it("reconoce los campos de texto", () => {
    expect(escribiendoEnCampo({ tagName: "INPUT" } as never)).toBe(true);
    expect(escribiendoEnCampo({ tagName: "TEXTAREA" } as never)).toBe(true);
    expect(escribiendoEnCampo({ tagName: "SELECT" } as never)).toBe(true);
    expect(escribiendoEnCampo({ tagName: "DIV", isContentEditable: true } as never)).toBe(true);
    expect(escribiendoEnCampo({ tagName: "DIV", isContentEditable: false } as never)).toBe(false);
    expect(escribiendoEnCampo(null)).toBe(false);
  });
});
