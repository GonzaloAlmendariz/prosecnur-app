import { describe, expect, it, vi } from "vitest";
import { terminarTransiciones, transicionMueve } from "./movimientoReducido";

describe("movimiento reducido filtra por propiedad, no por posición (D6)", () => {
  it("lo que desplaza se termina; fundidos y colores se conservan", () => {
    for (const p of ["transform", "translate", "scale", "rotate", "left", "top", "width", "height", "margin-left"]) {
      expect(transicionMueve(p)).toBe(true);
    }
    for (const p of ["opacity", "color", "background-color", "border-top-color", "outline-color", "text-decoration-color", "fill", "stroke", "box-shadow", "filter", "visibility"]) {
      expect(transicionMueve(p)).toBe(false);
    }
  });

  it("en un cajón con `transform 280ms, opacity 160ms` sólo se termina la de transform", () => {
    const el = {};
    const transform = { transitionProperty: "transform", finish: vi.fn(), effect: { target: el, pseudoElement: null } };
    const opacidad = { transitionProperty: "opacity", finish: vi.fn(), effect: { target: el, pseudoElement: null } };
    const ajena = { transitionProperty: "transform", finish: vi.fn(), effect: { target: {}, pseudoElement: null } };
    expect(terminarTransiciones([transform, opacidad, ajena], el, "transform", "")).toBe(1);
    expect(transform.finish).toHaveBeenCalledOnce();
    expect(opacidad.finish).not.toHaveBeenCalled();
    expect(ajena.finish).not.toHaveBeenCalled();
  });

  it("distingue el pseudo-elemento", () => {
    const el = {};
    const antes = { transitionProperty: "transform", finish: vi.fn(), effect: { target: el, pseudoElement: "::before" } };
    const propia = { transitionProperty: "transform", finish: vi.fn(), effect: { target: el, pseudoElement: null } };
    expect(terminarTransiciones([antes, propia], el, "transform", "::before")).toBe(1);
    expect(antes.finish).toHaveBeenCalledOnce();
    expect(propia.finish).not.toHaveBeenCalled();
  });
});
