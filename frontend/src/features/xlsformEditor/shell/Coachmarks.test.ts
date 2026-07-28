import { afterAll, describe, expect, test } from "vitest";

import { computeCalloutPos, computeSpotlightRect } from "./Coachmarks";

/**
 * El halo del tour tiene que quedarse pegado al elemento que señala. La regresión
 * original: `computeSpotlightRect` cedía el `top` para que el rect entrara entero
 * en pantalla, así que con un target más alto que el viewport el halo se despegaba
 * y arrastraba al callout —que con `placement: "top"` terminaba sobre la barra
 * superior del editor—. Medido a 1024x640 sobre acnur_acg: tarjeta en y=536, halo
 * en y=300, 228 px de deriva.
 *
 * La suite corre en entorno node (no hay jsdom en el repo) y estas dos funciones
 * solo leen `innerWidth`/`innerHeight`, así que alcanza con stubbear eso.
 */

const MARGIN = 18;
const PAD = 8;
const MIN_H = 72;

const windowPrevio = (globalThis as { window?: unknown }).window;

function conViewport(width: number, height: number) {
  (globalThis as { window?: unknown }).window = { innerWidth: width, innerHeight: height };
}

afterAll(() => {
  (globalThis as { window?: unknown }).window = windowPrevio;
});

function rect(top: number, height: number, left = 340, width = 620): DOMRect {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("computeSpotlightRect", () => {
  test("se ancla al borde superior del target aunque este exceda el viewport", () => {
    conViewport(1024, 640);
    const target = rect(536, 306);
    const spot = computeSpotlightRect(target);

    // Sin el fix esto daba 300: el halo se despegaba 228 px de su target.
    expect(spot.top).toBe(target.top - PAD);
    expect(spot.bottom).toBeLessThanOrEqual(640 - MARGIN);
  });

  test("no se sale por abajo cuando el target arranca pegado al borde inferior", () => {
    conViewport(1024, 640);
    const spot = computeSpotlightRect(rect(600, 40));

    // El piso de altura mínima no puede ganarle al recorte del viewport.
    expect(spot.bottom).toBeLessThanOrEqual(640);
    expect(spot.height).toBeGreaterThanOrEqual(MIN_H);
  });

  test("un target que entra cómodo no sufre deriva ninguna", () => {
    conViewport(1024, 640);
    const target = rect(200, 120);
    const spot = computeSpotlightRect(target);

    expect(spot.top).toBe(target.top - PAD);
    expect(spot.height).toBe(120 + PAD * 2);
  });
});

describe("computeCalloutPos", () => {
  test("con el halo anclado, el callout ya no aterriza sobre la barra superior", () => {
    conViewport(1024, 640);
    // La barra del editor ocupa aproximadamente y=85..233.
    const pos = computeCalloutPos(computeSpotlightRect(rect(536, 306)), "top");

    expect(pos.top).toBeGreaterThan(233);
  });

  test("nunca se sale del viewport", () => {
    conViewport(1024, 640);
    for (const top of [0, 120, 400, 620]) {
      const pos = computeCalloutPos(computeSpotlightRect(rect(top, 80)), "top");
      expect(pos.top).toBeGreaterThanOrEqual(12);
      expect(pos.left).toBeGreaterThanOrEqual(12);
    }
  });
});
