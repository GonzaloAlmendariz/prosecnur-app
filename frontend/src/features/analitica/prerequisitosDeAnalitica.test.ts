import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fuente = fs.readFileSync(path.join(aqui, "AnaliticaPage.tsx"), "utf8");

/**
 * **Los prerequisitos son insumos UTILIZABLES, no archivos subidos.**
 *
 * `prereqOk` miraba `xlsform && data`, que valen `true` en cuanto hay ficheros
 * en la sesión aunque nadie los haya parseado. Medido en pantalla el 2026-08-23
 * sobre un proyecto con los dos archivos y ningún paso corrido
 * —`instrumento_parsed` y `data_previewed` en `false`—: la compuerta «Carga los
 * insumos del estudio» no se mostraba, Analítica lanzaba la preparación igual y
 * fallaba con «faltan 119 de 119 variables esperadas».
 *
 * Tres superficies contando lo mismo de tres formas: Carga decía «Pendiente ·
 * Aún no hay datos», Analítica un error de 119 variables, y el estado
 * `data: true`. Las tres ciertas, ninguna entendible junto a las otras.
 *
 * Guardián de fuente: la condición es una expresión inline de una línea y lo
 * que hay que fijar es **de qué flags depende**. Que la compuerta se pinte se
 * verificó en pantalla.
 */
describe("prereqOk de Analítica", () => {
  it("depende de los flags de PASO, no de la existencia de archivos", () => {
    expect(fuente).toContain("state?.instrumento_parsed");
    expect(fuente).toContain("state?.data_previewed");
    // El par que valía `true` con archivos sin procesar.
    expect(fuente).not.toMatch(/prereqOk = prepOk\s*\|\|\s*\(!!state\?\.xlsform && !!state\?\.data\)/);
  });

  it("y `prepOk` sigue mandando sobre todo lo demás", () => {
    // Un proyecto que YA preparó no puede volver a la compuerta porque sus
    // flags intermedios estén en otro sitio.
    expect(fuente).toMatch(/const prereqOk = prepOk\s*$/m);
  });
});
