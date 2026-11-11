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
  const hoja = readFileSync(fileURLToPath(new URL("./codificar.css", import.meta.url)), "utf8");

  test("la rejilla de dos columnas depende del ancho de la columna de códigos (640 px), no de la ventana", () => {
    expect(hoja).toMatch(/\.pulso-cc-codigos\.pulso-panel \{\s*container: pulso-cc-codigos \/ inline-size;/);
    expect(hoja).toMatch(/@container pulso-cc-codigos \(min-width: 640px\) \{\s*\.pulso-cc-codigos-lista \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  });

  test("Tarjetas y Tabla reparten igual el ancho entre respuestas y códigos", () => {
    expect(hoja).toMatch(/\.pulso-cv2-split\.pulso-cc-split,\s*\.pulso-cv2-split\.pulso-cc-split\.pulso-ct-split \{\s*grid-template-columns: minmax\(0, 1\.2fr\) minmax\(0, 1fr\);/);
  });
});
