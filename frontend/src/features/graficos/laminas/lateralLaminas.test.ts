import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { clasesLaminasVacia, lateralVisible, resolverLateral } from "./lateralLaminas";

describe("resolverLateral", () => {
  it("la URL manda y pone al día la preferencia", () => {
    expect(resolverLateral("inspector", "estructura")).toEqual({ lateral: "inspector", escribirEnUrl: false, actualizarPreferencia: true });
    expect(resolverLateral("estructura", "estructura")).toEqual({ lateral: "estructura", escribirEnUrl: false, actualizarPreferencia: false });
  });
  it("sin panel en la URL, la preferencia se abre y se escribe (enlazable); con ambos cerrados no se escribe nada", () => {
    expect(resolverLateral(null, "estructura")).toEqual({ lateral: "estructura", escribirEnUrl: true, actualizarPreferencia: false });
    expect(resolverLateral(null, null)).toEqual({ lateral: null, escribirEnUrl: false, actualizarPreferencia: false });
  });
  it("un panel ajeno (avisos, biblioteca) no cierra el lateral recordado", () => {
    expect(resolverLateral("biblioteca-graficadores", "inspector")).toEqual({ lateral: "inspector", escribirEnUrl: false, actualizarPreferencia: false });
    expect(resolverLateral("avisos", "estructura").lateral).toBe("estructura");
  });
});

describe("lateralVisible (R7-3 y C1 del acabado)", () => {
  it("con Avisos abierto el Inspector no se ve; al cerrarlo vuelve", () => {
    expect(lateralVisible("inspector", true)).toBeNull();
    expect(lateralVisible("inspector", false)).toBe("inspector");
  });
  it("C1: la Estructura tampoco convive con Avisos; al cerrarlo vuelve", () => {
    expect(lateralVisible("estructura", true)).toBeNull();
    expect(lateralVisible("estructura", false)).toBe("estructura");
    expect(lateralVisible(null, true)).toBeNull();
    expect(lateralVisible(null, false)).toBeNull();
  });
  it("C1: nunca hay dos laterales a la vez", () => {
    for (const l of ["estructura", "inspector", null] as const) {
      for (const avisos of [true, false]) {
        const abiertos = [lateralVisible(l, avisos), avisos ? "avisos" : null].filter(Boolean);
        expect(abiertos.length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("R10-3: el informe vacío respeta C1 (un solo lateral)", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const leer = (rel: string) => fs.readFileSync(path.join(dir, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("sin Avisos el vacío lleva la Estructura; con Avisos la Estructura se oculta", () => {
    expect(clasesLaminasVacia(false)).toBe("pulso-f6-laminas is-vacia");
    expect(clasesLaminasVacia(true)).toBe("pulso-f6-laminas is-vacia is-sin-estructura");
  });

  it("PanelAvisos se monta DENTRO de .pulso-f6-laminas en el vacío, para entrar en su grid", () => {
    const src = leer("LaminasWorkbench.tsx");
    const vacio = src.slice(src.indexOf("if (!lamina || !slide)"), src.indexOf("<SelectorTipoLamina slide={null}"));
    expect(vacio).toContain("className={clasesLaminasVacia(avisos.abierto)}");
    const iAvisos = vacio.indexOf("<PanelAvisos");
    expect(iAvisos).toBeGreaterThan(-1);
    // Entre Avisos y los selectores (hijos del host) sólo se cierra el grid: Avisos es hijo de .pulso-f6-laminas.
    expect(vacio.slice(iAvisos).match(/<\/div>/g)).toHaveLength(1);
  });

  it("en el marco ancho, el vacío con Avisos toma la plantilla de cuatro columnas (Avisos en la suya, no superpuesto)", () => {
    const css = leer("panelAvisos.css");
    const ancho = css.slice(css.indexOf("@container pulso-f6-laminas (min-width: 1121px)"));
    expect(ancho).toMatch(/\.pulso-f6-laminas\.is-vacia:has\(> \.pulso-f6-avisos-panel\)\s*\{\s*grid-template-columns: 0px minmax\(0, 1fr\) 0px var\(--pulso-avisos-ancho\);/);
    expect(ancho).toMatch(/\.pulso-f6-laminas > \.pulso-f6-avisos-panel\s*\{[^}]*position: relative;[^}]*grid-column: 4;/);
    // La Estructura oculta con `is-sin-estructura` es la regla común del workbench.
    expect(leer("laminasWorkbench.css")).toMatch(/\.pulso-f6-laminas\.is-sin-estructura > \.pulso-f6-estructura/);
  });
});
