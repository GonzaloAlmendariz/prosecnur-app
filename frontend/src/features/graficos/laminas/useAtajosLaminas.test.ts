// Atajos de Láminas (C21): J/K, Alt+↑/↓ y «/», una sola vez por tecla aunque `useShortcutsV2` siga escuchando en
// `window`, sin pisar a quien ya detuvo la tecla (Orden de un gráfico, índice) y sin actuar mientras se escribe.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  atenderAtajoLaminas,
  esDestinoEditable,
  FASE_ATAJOS,
  instalarAtajosLaminas,
  intencionAtajoLaminas,
  posicionDestino,
  type AccionesAtajos,
  type EventoAtajo,
} from "./useAtajosLaminas";

const tecla = (key: string, mods: Partial<Record<"altKey" | "shiftKey" | "ctrlKey" | "metaKey", boolean>> = {}) => ({
  key, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...mods,
});

type Registro = { ir: number[]; mover: string[]; buscar: number };

function acciones(over: Partial<AccionesAtajos> = {}): AccionesAtajos & { registro: Registro } {
  const registro: Registro = { ir: [], mover: [], buscar: 0 };
  return {
    activo: true, posicion: 2, total: 4,
    onIr: (p) => registro.ir.push(p),
    onMover: (d) => registro.mover.push(d),
    onBuscar: () => { registro.buscar += 1; },
    ...over,
    registro,
  };
}

type Evento = EventoAtajo & { detenido: boolean };
function evento(key: string, mods: Parameters<typeof tecla>[1] = {}, target: unknown = { tagName: "BUTTON" }): Evento {
  const e: Evento = {
    ...tecla(key, mods), target, defaultPrevented: false, detenido: false,
    preventDefault: () => { e.defaultPrevented = true; },
    stopPropagation: () => { e.detenido = true; },
  };
  return e;
}

describe("intencionAtajoLaminas", () => {
  it("J/K navegan, Alt+↑/↓ mueven y «/» busca", () => {
    expect(intencionAtajoLaminas(tecla("j"))).toEqual({ tipo: "navegar", delta: 1 });
    expect(intencionAtajoLaminas(tecla("J", { shiftKey: true }))).toEqual({ tipo: "navegar", delta: 1 });
    expect(intencionAtajoLaminas(tecla("k"))).toEqual({ tipo: "navegar", delta: -1 });
    expect(intencionAtajoLaminas(tecla("ArrowUp", { altKey: true }))).toEqual({ tipo: "mover", dir: "up" });
    expect(intencionAtajoLaminas(tecla("ArrowDown", { altKey: true }))).toEqual({ tipo: "mover", dir: "down" });
    expect(intencionAtajoLaminas(tecla("/"))).toEqual({ tipo: "buscar" });
    expect(intencionAtajoLaminas(tecla("/", { shiftKey: true }))).toEqual({ tipo: "buscar" });
  });

  it("con Cmd/Ctrl, Alt+J o flechas sin Alt no son atajos de Láminas", () => {
    expect(intencionAtajoLaminas(tecla("j", { metaKey: true }))).toBeNull();
    expect(intencionAtajoLaminas(tecla("k", { ctrlKey: true }))).toBeNull();
    expect(intencionAtajoLaminas(tecla("j", { altKey: true }))).toBeNull();
    expect(intencionAtajoLaminas(tecla("ArrowUp"))).toBeNull();
    expect(intencionAtajoLaminas(tecla("ArrowUp", { altKey: true, shiftKey: true }))).toBeNull();
    expect(intencionAtajoLaminas(tecla("ArrowUp", { altKey: true, metaKey: true }))).toBeNull();
    expect(intencionAtajoLaminas(tecla("v"))).toBeNull();
    expect(intencionAtajoLaminas(tecla("?", { shiftKey: true }))).toBeNull();
  });
});

describe("esDestinoEditable", () => {
  it("input, textarea, select y contenteditable son campos donde se escribe", () => {
    expect(esDestinoEditable({ tagName: "INPUT" })).toBe(true);
    expect(esDestinoEditable({ tagName: "textarea" })).toBe(true);
    expect(esDestinoEditable({ tagName: "SELECT" })).toBe(true);
    expect(esDestinoEditable({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(esDestinoEditable({ tagName: "BUTTON" })).toBe(false);
    expect(esDestinoEditable({ tagName: "DIV", isContentEditable: false })).toBe(false);
    expect(esDestinoEditable(null)).toBe(false);
  });
});

describe("posicionDestino", () => {
  it("avanza y retrocede dentro del informe, sin salirse", () => {
    expect(posicionDestino(2, 4, 1)).toBe(3);
    expect(posicionDestino(2, 4, -1)).toBe(1);
    expect(posicionDestino(4, 4, 1)).toBeNull();
    expect(posicionDestino(1, 4, -1)).toBeNull();
    expect(posicionDestino(null, 4, 1)).toBe(1);
    expect(posicionDestino(null, 0, 1)).toBeNull();
  });
});

describe("atenderAtajoLaminas", () => {
  it("J lleva a la lámina siguiente y K a la anterior", () => {
    const a = acciones();
    expect(atenderAtajoLaminas(evento("j"), a)).toBe(true);
    expect(atenderAtajoLaminas(evento("k"), a)).toBe(true);
    expect(a.registro.ir).toEqual([3, 1]);
  });

  it("Alt+↑/↓ mueve la lámina activa, salvo en el borde", () => {
    const a = acciones();
    atenderAtajoLaminas(evento("ArrowUp", { altKey: true }), a);
    atenderAtajoLaminas(evento("ArrowDown", { altKey: true }), a);
    expect(a.registro.mover).toEqual(["up", "down"]);
    const primera = acciones({ posicion: 1 });
    atenderAtajoLaminas(evento("ArrowUp", { altKey: true }), primera);
    expect(primera.registro.mover).toEqual([]);
  });

  it("«/» pide enfocar la búsqueda", () => {
    const a = acciones();
    atenderAtajoLaminas(evento("/"), a);
    expect(a.registro.buscar).toBe(1);
  });

  it("dentro de un input no actúa ni consume la tecla (se escribe una «j»)", () => {
    const a = acciones();
    const e = evento("j", {}, { tagName: "INPUT" });
    expect(atenderAtajoLaminas(e, a)).toBe(false);
    expect(e.detenido).toBe(false);
    expect(e.defaultPrevented).toBe(false);
    const ce = evento("ArrowUp", { altKey: true }, { tagName: "DIV", isContentEditable: true });
    atenderAtajoLaminas(ce, a);
    expect(a.registro).toEqual({ ir: [], mover: [], buscar: 0 });
  });

  it("con un diálogo encima, o si otro manejador ya la usó, la consume sin actuar", () => {
    const tapada = acciones({ activo: false });
    const e = evento("j");
    expect(atenderAtajoLaminas(e, tapada)).toBe(true);
    expect(e.detenido).toBe(true);
    expect(tapada.registro.ir).toEqual([]);
    const usada = acciones();
    const u = evento("ArrowUp", { altKey: true });
    u.defaultPrevented = true;
    atenderAtajoLaminas(u, usada);
    expect(u.detenido).toBe(true);
    expect(usada.registro.mover).toEqual([]);
  });

  it("una tecla ajena no se consume", () => {
    const e = evento("v");
    expect(atenderAtajoLaminas(e, acciones())).toBe(false);
    expect(e.detenido).toBe(false);
  });
});

// Recorrido de un keydown que no es de un campo: window(captura) → document(captura) → manejador de React en la raíz
// (la fila «Orden» o el índice, que detienen Alt+↑/↓) → document(burbuja) → window(burbuja: `useShortcutsV2`).
type Fn = (e: KeyboardEvent) => void;
function escucha() {
  const lista: { fn: Fn; captura: boolean }[] = [];
  return {
    lista,
    addEventListener: (_t: "keydown", fn: Fn, captura: boolean) => { lista.push({ fn, captura }); },
    removeEventListener: (_t: "keydown", fn: Fn, captura: boolean) => {
      const i = lista.findIndex((x) => x.fn === fn && x.captura === captura);
      if (i >= 0) lista.splice(i, 1);
    },
  };
}

function recorrer(e: Evento, doc: ReturnType<typeof escucha>, win: ReturnType<typeof escucha>, react: ((e: Evento) => void) | null) {
  const pasos: (() => void)[] = [
    ...win.lista.filter((x) => x.captura).map((x) => () => x.fn(e as unknown as KeyboardEvent)),
    ...doc.lista.filter((x) => x.captura).map((x) => () => x.fn(e as unknown as KeyboardEvent)),
    ...(react ? [() => react(e)] : []),
    ...doc.lista.filter((x) => !x.captura).map((x) => () => x.fn(e as unknown as KeyboardEvent)),
    ...win.lista.filter((x) => !x.captura).map((x) => () => x.fn(e as unknown as KeyboardEvent)),
  ];
  for (const paso of pasos) {
    if (e.detenido) return;
    paso();
  }
}

describe("una sola vez por tecla junto a useShortcutsV2", () => {
  function montar() {
    const doc = escucha();
    const win = escucha();
    const a = acciones();
    const desmontar = instalarAtajosLaminas(doc, () => a);
    // Stand-in de useShortcutsV2: en `window`, burbuja; mueve/navega sin mirar `defaultPrevented`.
    const v2 = { mover: 0, navegar: 0 };
    win.addEventListener("keydown", (e) => {
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) v2.mover += 1;
      else if (e.key === "j" || e.key === "k") v2.navegar += 1;
    }, false);
    return { doc, win, a, v2, desmontar };
  }

  it("se instala en burbuja, no en captura", () => {
    expect(FASE_ATAJOS.captura).toBe(false);
  });

  it("Alt+↑ mueve la lámina una vez: el listener de window no la ve", () => {
    const m = montar();
    recorrer(evento("ArrowUp", { altKey: true }), m.doc, m.win, null);
    expect(m.a.registro.mover).toEqual(["up"]);
    expect(m.v2.mover).toBe(0);
    recorrer(evento("j"), m.doc, m.win, null);
    expect(m.a.registro.ir).toEqual([3]);
    expect(m.v2.navegar).toBe(0);
  });

  it("Alt+↑ sobre una categoría de Orden mueve la categoría y no la lámina", () => {
    const m = montar();
    let categoria = 0;
    recorrer(evento("ArrowUp", { altKey: true }), m.doc, m.win, (e) => { categoria += 1; e.stopPropagation(); });
    expect(categoria).toBe(1);
    expect(m.a.registro.mover).toEqual([]);
    expect(m.v2.mover).toBe(0);
  });

  it("dentro de un input ni Láminas ni el listener heredado actúan por Láminas", () => {
    const m = montar();
    recorrer(evento("j", {}, { tagName: "INPUT" }), m.doc, m.win, null);
    expect(m.a.registro.ir).toEqual([]);
  });

  it("al desmontar deja de escuchar", () => {
    const m = montar();
    m.desmontar();
    expect(m.doc.lista).toHaveLength(0);
  });
});

describe("C32/O3: los textos de Láminas no mandan al Editor anterior", () => {
  const sinComentarios = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  it("EstructuraInforme e InspectorLamina no nombran ni enlazan el Editor anterior", () => {
    for (const ruta of ["./EstructuraInforme.tsx", "./InspectorLamina.tsx"]) {
      const fuente = sinComentarios(ruta);
      expect(fuente, ruta).not.toMatch(/Editor anterior/);
      expect(fuente, ruta).not.toMatch(/onClick=\{onIrEditorAnterior\}/);
    }
  });

  it("el estilo Word del informe lleva a la pestaña «Identidad»", () => {
    const fuente = sinComentarios("./InspectorLamina.tsx");
    expect(fuente).toMatch(/irA\("pestana", "estilo"\)/);
    expect(fuente).toMatch(/>Identidad</);
  });
});
