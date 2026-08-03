import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Todo lo que se mueve tiene que poder no moverse.
 *
 * El movimiento de estas piezas explica un cambio —la barra aparece, la cifra
 * funde cuando se recalcula—, así que quien desactiva las animaciones no puede
 * perder información: sólo pierde la transición.
 *
 * Este guard es estático a propósito: comprueba que **cada selector animado
 * tiene su contrapartida** en el bloque `prefers-reduced-motion`. Una
 * comprobación en ejecución exigiría emular la preferencia del sistema, y aun
 * así no detectaría la animación que alguien añada mañana.
 */
// Sin comentarios: explican las animaciones y citan sus nombres, así que un
// extractor ingenuo los toma por selectores —el patrón 13 del ADR otra vez—.
function leer(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * F111 · La hoja del gráfico entra a este guard el mismo día que nace.
 *
 * Cuando el gráfico se mudó a `distribucionCategoria.css`, este guard seguía
 * mirando sólo la hoja de la tarjeta: una animación nueva en el archivo nuevo
 * habría quedado sin vigilar y el test verde. Un guard que no crece con su
 * superficie es un falso verde con retardo.
 */
const HOJAS = ["../categoriaEvidencia.css", "../distribucionCategoria.css"] as const;

/** Selectores que declaran `animation:` o `transition:` fuera del bloque reducido. */
function selectoresConMovimiento(fuente: string): string[] {
  const antes = fuente.slice(0, fuente.indexOf("@media (prefers-reduced-motion"));
  const encontrados: string[] = [];
  const reglas = antes.split("}");
  for (const regla of reglas) {
    if (!/\b(animation|transition):/.test(regla)) continue;
    const selector = regla.slice(0, regla.indexOf("{")).trim().split(",")[0].trim();
    if (selector.startsWith("@") || !selector) continue;
    encontrados.push(selector);
  }
  return encontrados;
}

describe.each(HOJAS)("movimiento reducido · %s", (hoja) => {
  const css = leer(hoja);
  const bloqueReducido = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

  it("declara un bloque de movimiento reducido", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("cada selector animado se apaga cuando se pide menos movimiento", () => {
    const animados = selectoresConMovimiento(css);
    expect(animados.length).toBeGreaterThan(0);
    for (const selector of animados) {
      expect(bloqueReducido, `sin contrapartida: ${selector}`).toContain(selector);
    }
  });
});

describe("movimiento reducido · nada que codifique un valor se anima", () => {
  it("ninguna capa del gráfico se anima con transform", () => {
    // F55 · Una animación `scaleX` dejó la barra intercuartílica clavada en su
    // primer fotograma: 3 px renderizados con 154,7 px computados. El ancho de
    // esa barra ES el dato. La regla que se derivó vale para las tres capas.
    const css = leer("../distribucionCategoria.css");
    const conMovimiento = selectoresConMovimiento(css);
    for (const sel of conMovimiento) {
      const regla = css.slice(css.indexOf(sel));
      const cuerpo = regla.slice(0, regla.indexOf("}"));
      expect(cuerpo, `${sel} anima transform`).not.toMatch(/transition:[^;]*transform/);
      expect(cuerpo, `${sel} anima transform`).not.toMatch(/animation:[^;]*scale/);
    }
  });
});
