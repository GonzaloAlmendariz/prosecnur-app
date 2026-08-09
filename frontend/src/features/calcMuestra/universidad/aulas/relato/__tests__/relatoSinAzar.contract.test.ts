/**
 * Gate 1 del ADR 0067 · cero azar decorativo, vigilado sobre el fuente.
 *
 * «El relato nunca re-sortea»: ningún archivo del relato puede usar
 * `Math.random()`, `crypto.getRandomValues` ni barajar/generar un orden de
 * eventos propio. El orden viene del dato persistido (`discount_step`, olas,
 * `replacement_order`) o se declara ausente. Mismo patrón que
 * `adr0057Reglas.contract.test.ts`: la regla se vigila a sí misma, con
 * independencia de qué componente se toque después.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const RAIZ_RELATO = fileURLToPath(new URL("../", import.meta.url));

function archivosFuente(dir: string): string[] {
  const resultado: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      // Los tests nombran los patrones prohibidos para vigilarlos: se excluyen
      // a sí mismos; la regla aplica al código que la app ejecuta.
      if (nombre === "__tests__") continue;
      resultado.push(...archivosFuente(ruta));
      continue;
    }
    if (/\.(ts|tsx|css)$/.test(nombre)) resultado.push(ruta);
  }
  return resultado;
}

/** Fuente sin comentarios: la regla se vigila sobre lo que ejecuta/renderiza. */
function leerSinComentarios(ruta: string): string {
  return readFileSync(ruta, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("ADR 0067 · gate 1 — cada cuadro es un hecho del sorteo ejecutado", () => {
  const archivos = archivosFuente(RAIZ_RELATO);

  it("el directorio del relato existe y tiene fuentes que vigilar", () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  for (const patron of [
    /Math\.random\s*\(/,
    /getRandomValues/,
    /\bshuffle\b/i,
    // Un comparator que ignora sus argumentos solo puede fabricar un orden.
    /\.sort\(\s*\(\s*\)\s*=>/,
  ]) {
    it(`ningún fuente del relato matchea ${String(patron)}`, () => {
      for (const ruta of archivos) {
        expect(leerSinComentarios(ruta), ruta).not.toMatch(patron);
      }
    });
  }

  it("el arco, los tirantes y el idle son funciones puras del dato", () => {
    // Lógica World of Goo destilada (2026-08-07): arco de vuelo, topología de
    // tirantes (2 vecinas más cercanas del layout ya calculado) y bobbing
    // idle con duración/fase por índice — todo pre-computado, sin física en
    // runtime ni azar por render. El barrido de patrones prohibidos de arriba
    // los cubre; esto fija que las primitivas existen y viven en goo.tsx.
    const goo = leerSinComentarios(join(RAIZ_RELATO, "escenas/goo.tsx"));
    expect(goo).toContain("export function arcoGoo");
    expect(goo).toContain("export function origenBombo");
    expect(goo).toContain("export function membranaGoo");
    expect(goo).toContain("export function vecinasMasCercanas");
    // Desincronía determinista del idle: 3s + (i % 5)·0.35s, fase i·0.13s.
    expect(goo).toContain("export function bobbingDeBola");
    expect(goo).toContain("% 5");
    expect(goo).toContain("* 0.13");
  });

  it("el asentamiento es una senoide amortiguada multi-pico, con fases fijas", () => {
    // El corazón del feel: la bola se pasa del equilibrio y oscila de vuelta
    // (+8% → −4% → +2% → −1% → 0), la estructura respira con delays fijos de
    // 60/120 ms y el tirante hace preview→snap. Constantes, jamás un azar.
    const css = leerSinComentarios(join(RAIZ_RELATO, "relato.css"));
    const aterrizar = css.slice(css.indexOf("@keyframes cmv2-relato-goo-aterrizar"));
    for (const pico of ["scale(1.08)", "scale(0.96)", "scale(1.02)", "scale(0.99)"]) {
      expect(aterrizar, pico).toContain(pico);
    }
    expect(css).toContain("@keyframes cmv2-relato-goo-onda");
    expect(css).toContain("cmv2-relato-goo-onda 720ms var(--motion-ease-out) 60ms both");
    expect(css).toContain("cmv2-relato-goo-onda 720ms var(--motion-ease-out) 120ms both");
    expect(css).toContain("@keyframes cmv2-relato-tirante-snap");
    expect(css).toContain("@keyframes cmv2-relato-tirante-vibra");
    expect(css).toContain("@keyframes cmv2-relato-goo-bobbing");
  });

  it("el orden del sorteo sale del dato persistido, no de una secuencia propia", () => {
    const modelo = leerSinComentarios(join(RAIZ_RELATO, "relatoModel.ts"));
    // La historia paso a paso se construye sobre `discount_step` vía la
    // narrativa del descuento (que ordena por el paso que persistió el motor).
    expect(modelo).toContain("buildDiscountNarrative");
    // Y la ausencia de ese rastro se declara, nunca se dramatiza.
    expect(modelo).toContain("no registró el orden del sorteo");
  });
});

describe("E4 · composición legible del campo", () => {
  const escena = leerSinComentarios(join(RAIZ_RELATO, "escenas/EscenaSorteo.tsx"));

  it("el rótulo fijo es solo el de la bola recién encendida", () => {
    // Con las 60 encendidas rotuladas a la vez, las etiquetas se pisaban entre
    // sí —11 pares medidos en la app— y la escena se leía sucia aunque ninguna
    // bola se tocara. La secuencia completa vive en la lista de abajo, y el
    // resto conserva su código en hover y en el `<title>` (C4: alcanzable).
    expect(escena).toContain("esReciente ? (");
    expect(escena).toContain('cmv2-relato-goo-rotulo is-reciente');
    expect(escena).toContain('cmv2-relato-goo-rotulo is-hover');
    // Si volviera a colgarse del estado «encendida», los 60 rótulos regresan.
    expect(escena).not.toMatch(/encendida \? \(\s*<text/);
  });

  it("el radio se escala con la densidad del campo", () => {
    // El tope de bolas recorta la cantidad, no el tamaño: sin escalar por
    // densidad, 60 bolas del tamaño del dato se encaraman hasta la mancha.
    expect(escena).toContain("escalaPorDensidad");
    const goo = leerSinComentarios(join(RAIZ_RELATO, "escenas/goo.tsx"));
    expect(goo).toContain("export function escalaPorDensidad");
  });

  it("la cola usa la espiral continua, no la de Vogel", () => {
    // Vogel dispersa a propósito (137° entre consecutivos): perfecto para un
    // bombo sin orden y exactamente lo contrario de lo que una cola necesita.
    expect(escena).toContain("posicionCadena");
    expect(escena).not.toContain("posicionGoo(index, unidades.length)");
  });
});
