import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { lugarDelFantasma } from "./arrastreDeRespuestas";
import { fraseDeMarcaPrevia } from "./modeloDeCodificar";

const ventana = { width: 1366, height: 768 };
const fantasma = { width: 320, height: 36 };

describe("dónde se dibuja el fantasma del arrastre", () => {
  test("con espacio, abajo a la derecha del cursor", () => {
    expect(lugarDelFantasma({ x: 400, y: 300 }, fantasma, ventana)).toEqual({ left: 412, top: 312 });
  });

  test("cerca del borde derecho, a la izquierda del cursor: nunca sale de la ventana", () => {
    const lugar = lugarDelFantasma({ x: 1330, y: 300 }, fantasma, ventana);
    expect(lugar.left).toBe(1330 - 12 - 320);
    expect(lugar.left + fantasma.width).toBeLessThanOrEqual(ventana.width);
  });

  test("cerca del borde inferior, sobre el cursor; en una ventana angosta, pegado al margen", () => {
    expect(lugarDelFantasma({ x: 400, y: 760 }, fantasma, ventana).top).toBe(760 - 12 - 36);
    expect(lugarDelFantasma({ x: 100, y: 100 }, fantasma, { width: 300, height: 600 }).left).toBe(8);
  });
});

describe("la frase de una opción ya marcada", () => {
  test("dice cuántos casos y sobre cuántos, en llano", () => {
    expect(fraseDeMarcaPrevia(3, 4)).toBe("3 de 4 casos ya tenían marcada esta opción");
    expect(fraseDeMarcaPrevia(4, 4)).toBe("Los 4 casos ya tenían marcada esta opción");
    expect(fraseDeMarcaPrevia(1, 1)).toBe("El caso ya tenía marcada esta opción");
  });
});

describe("la hoja de Codificar", () => {
  const leer = (nombre: string) => readFileSync(fileURLToPath(new URL(`./${nombre}`, import.meta.url)), "utf8");
  const marco = leer("codificar.css");
  const codigos = leer("codigos.css");

  test("las tarjetas de código se reparten por el ancho de su columna, no de la ventana", () => {
    expect(codigos).toMatch(/\.pulso-panel-de-mesa--codigos \{\s*container: pulso-cc-codigos \/ inline-size;/);
    expect(codigos).toMatch(/\.pulso-cc-codigos-lista \{\s*display: grid;\s*grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, 13rem\), 1fr\)\);/);
  });

  test("Tarjetas y Tabla reparten igual el ancho entre respuestas y códigos (prototipo pp-m3c: 280, 1fr, 1fr)", () => {
    expect(marco).toMatch(/\[data-qa-geometry-group="codificacion\/codificar-mesa"\] \{\s*grid-template-columns: 280px minmax\(0, 1fr\) minmax\(0, 1fr\);/);
  });
});
