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
const css = readFileSync(
  fileURLToPath(new URL("../categoriaEvidencia.css", import.meta.url)),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

const bloqueReducido = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

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

describe("categoriaEvidencia · movimiento reducido", () => {
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

  it("apagar el movimiento no esconde la barra", () => {
    // La barra aparece con `opacity`; sin `opacity: 1` explícito, apagar la
    // animación con `both` la dejaría en su fotograma inicial —invisible—, que
    // es la misma familia del defecto que corrompió el dato en F55.
    const regla = bloqueReducido.slice(bloqueReducido.indexOf(".cmv2-cat-rango"));
    expect(regla.slice(0, regla.indexOf("}"))).toContain("opacity: 1");
  });
});
