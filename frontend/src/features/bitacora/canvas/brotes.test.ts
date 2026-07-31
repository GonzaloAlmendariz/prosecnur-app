import { describe, expect, it } from "vitest";

import type { CanvasNodo } from "../../../api/bitacora";
import { ALTO_BROTE, brotesDe, posicionDelNodo } from "./brotes";

function nodo(destino: string | null, extra: Partial<CanvasNodo> = {}): CanvasNodo {
  return {
    id: destino ?? "n",
    type: destino ? "referencia" : "texto",
    x: 0,
    y: 0,
    w: 240,
    h: 102,
    z: 0,
    color: "neutro",
    text: "",
    items: [],
    ref: destino ? { target_type: "modulo", target_id: destino } : null,
    links: [],
    ...extra,
  };
}

describe("brotesDe", () => {
  it("un módulo ofrece sus secciones y sus modos", () => {
    const brotes = brotesDe(nodo("procesamiento"), []);
    expect(brotes.map((b) => b.label)).toContain("Carga");
    expect(brotes.every((b) => b.nivel === "seccion" || b.nivel === "modo")).toBe(true);
  });

  it("una sección con pestañas ofrece sus pestañas", () => {
    const brotes = brotesDe(nodo("procesamiento/carga"), []);
    expect(brotes.length).toBeGreaterThan(0);
    expect(brotes.every((b) => b.nivel === "pestana")).toBe(true);
  });

  it("una hoja del árbol no ofrece nada", () => {
    expect(brotesDe(nodo("procesamiento/validacion/explorar"), [])).toEqual([]);
  });

  it("un nodo de texto no ofrece nada", () => {
    expect(brotesDe(nodo(null), [])).toEqual([]);
  });

  it("no ofrece lo que ya está en el lienzo", () => {
    // Duplicar una rama no dice dos cosas distintas: dice que la herramienta
    // falló.
    const todas = brotesDe(nodo("procesamiento"), []);
    const yaPuesta = todas[0].clave;
    const quedan = brotesDe(nodo("procesamiento"), [nodo(yaPuesta)]);
    expect(quedan.map((b) => b.clave)).not.toContain(yaPuesta);
    expect(quedan).toHaveLength(todas.length - 1);
  });

  it("sin ramas libres el abanico queda vacío en vez de ofrecer un hueco", () => {
    const todas = brotesDe(nodo("procesamiento"), []);
    const puestas = todas.map((b) => nodo(b.clave));
    expect(brotesDe(nodo("procesamiento"), puestas)).toEqual([]);
  });

  it("el abanico sale del costado derecho, que es hacia donde crece el mapa", () => {
    const origen = nodo("procesamiento", { x: 500, y: 300 });
    for (const b of brotesDe(origen, [])) expect(b.x).toBeGreaterThan(origen.x);
  });

  it("el abanico arranca centrado frente al cuadro que lo abre", () => {
    // Arranca centrado y baja: cada brote reserva el alto de su futura tarjeta,
    // así que el abanico completo queda por debajo del centro, no repartido.
    const origen = nodo("procesamiento", { x: 500, y: 300 });
    const brotes = brotesDe(origen, []);
    const centroCuadro = origen.y + origen.h / 2;
    const alto = brotes.length * ALTO_BROTE + (brotes.length - 1) * 8;
    expect(brotes[0].y).toBeCloseTo(centroCuadro - alto / 2, 5);
  });

  it("los brotes no se pisan entre sí", () => {
    const brotes = brotesDe(nodo("procesamiento"), []);
    for (let i = 1; i < brotes.length; i++) {
      expect(brotes[i].y - brotes[i - 1].y).toBeGreaterThanOrEqual(ALTO_BROTE);
    }
  });
});

describe("posicionDelNodo", () => {
  it("el nodo nace EXACTAMENTE donde estaba su brote", () => {
    // El brote ya reservó el alto de la tarjeta y ya esquivó lo ocupado: que
    // las dos posiciones coincidan es lo que hace que la animación se lea como
    // que el brote se convirtió en tarjeta.
    const brote = brotesDe(nodo("procesamiento", { x: 0, y: 0 }), [])[0];
    const p = posicionDelNodo(brote);
    expect(p.x).toBe(brote.x);
    expect(p.y).toBe(brote.y);
  });
});

describe("los brotes no chocan con lo que ya está en el lienzo", () => {
  it("cada brote reserva el alto de la TARJETA que va a crear, no el suyo", () => {
    // Reservando solo sus 34 px, la tarjeta de 102 nacería encima de los brotes
    // de más abajo: es el choque que se veía al abrir dos ramas seguidas.
    const brotes = brotesDe(nodo("procesamiento"), []);
    const alto = posicionDelNodo(brotes[0]).h;
    for (let i = 1; i < brotes.length; i++) {
      expect(brotes[i].y - brotes[i - 1].y).toBeGreaterThanOrEqual(alto);
    }
  });

  it("un brote no nace sobre un nodo que ya ocupa la columna", () => {
    const padre = nodo("procesamiento", { id: "p", x: 0, y: 0 });
    const primero = brotesDe(padre, [padre])[0];
    const yaPuesto = { ...nodo(primero.clave, { id: "ya" }), ...posicionDelNodo(primero) };
    for (const b of brotesDe(padre, [padre, yaPuesto])) {
      const caja = posicionDelNodo(b);
      const chocan = caja.y < yaPuesto.y + yaPuesto.h && caja.y + caja.h > yaPuesto.y;
      expect(chocan).toBe(false);
    }
  });

  it("abrir las ramas de una en una nunca superpone dos tarjetas", () => {
    // Reproduce el gesto real: se abre una, se recalcula el abanico, se abre
    // otra. Es donde aparecía el choque.
    const padre = nodo("procesamiento", { id: "p", x: 0, y: 0 });
    let enLienzo = [padre];
    for (let i = 0; i < 5; i++) {
      const brotes = brotesDe(padre, enLienzo);
      if (!brotes.length) break;
      const caja = posicionDelNodo(brotes[0]);
      enLienzo = [...enLienzo, { ...nodo(brotes[0].clave, { id: `n${i}` }), ...caja }];
    }
    const puestos = enLienzo.filter((n) => n.id !== "p");
    expect(puestos.length).toBe(5);
    for (let i = 0; i < puestos.length; i++) {
      for (let j = i + 1; j < puestos.length; j++) {
        const a = puestos[i];
        const b = puestos[j];
        const chocan =
          Math.abs(a.x - b.x) < a.w && a.y < b.y + b.h && a.y + a.h > b.y;
        expect(chocan).toBe(false);
      }
    }
  });

  it("los brotes tampoco se pisan con las tarjetas ya abiertas", () => {
    const padre = nodo("procesamiento", { id: "p", x: 0, y: 0 });
    const primeros = brotesDe(padre, [padre]);
    const abierto = { ...nodo(primeros[0].clave, { id: "a" }), ...posicionDelNodo(primeros[0]) };
    for (const b of brotesDe(padre, [padre, abierto])) {
      const chocan = b.y < abierto.y + abierto.h && b.y + ALTO_BROTE > abierto.y;
      expect(chocan).toBe(false);
    }
  });
});
