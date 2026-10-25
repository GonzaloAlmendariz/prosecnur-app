import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Regresión del 2026-07-28, encontrada al interactuar con la vista real.
//
// Los `onChange` leían `event.currentTarget.value` DENTRO del updater de
// `setState`. React recicla el evento sintético en cuanto el handler retorna,
// así que para cuando la función de actualización corre, `currentTarget` ya es
// `null` — y la vista entera se cae con «Cannot read properties of null
// (reading 'value')». Cambiar un color o reasignar un estado reventaba el
// módulo.
//
// No lo atrapó ningún test de modelo porque el modelo estaba bien: el defecto
// vivía en el puente entre el evento y el estado. Se comprueba sobre el
// archivo porque montar el componente exigiría el árbol de contextos del
// módulo entero, y lo que hay que impedir es el patrón, que es reconocible.

// Desde T7 el borrador vive en `useDeclaracionDeEstados` y lo montan dos
// vistas: el definidor y Insumos › Estados del telefónico. Las dos se vigilan.
// El color de cada familia salió a `PaletaDeFamilias`, que montan las dos.
const ARCHIVOS = [
  path.resolve(__dirname, "DefinidorDeEstados.tsx"),
  path.resolve(__dirname, "../profiles/telefonico/insumos/Estados.tsx"),
];
const PALETA = path.resolve(__dirname, "PaletaDeFamilias.tsx");

describe.each([...ARCHIVOS, PALETA])("los handlers no leen el evento dentro del updater (%s)", (archivo) => {
  const fuente = fs.readFileSync(archivo, "utf8");

  test("ningún setState recibe un updater que use currentTarget", () => {
    // Busca `set…((…) => …event.currentTarget…)`, que es exactamente la forma
    // que falla.
    const updatersConEvento = /set[A-Z]\w*\(\s*\([^)]*\)\s*=>[\s\S]{0,220}?currentTarget/g;
    const hallazgos = fuente.match(updatersConEvento) ?? [];
    expect(hallazgos).toEqual([]);
  });

});

describe.each(ARCHIVOS)("cada vista captura el valor antes de actualizar (%s)", (archivo) => {
  const fuente = fs.readFileSync(archivo, "utf8");

  test("la familia del estado crudo", () => {
    expect(fuente).toMatch(/const elegida = event\.currentTarget\.value[\s\S]{0,140}asignar\(/);
  });

  test("el color lo edita la paleta común, no una copia", () => {
    expect(fuente).toMatch(/<PaletaDeFamilias\b/);
    expect(fuente).not.toMatch(/type="color"/);
  });
});

test("la paleta captura el color antes de guardarlo", () => {
  const fuente = fs.readFileSync(PALETA, "utf8");
  expect(fuente).toMatch(/const elegido = event\.currentTarget\.value;[\s\S]{0,120}colorear\(/);
});

test("el hook recibe valores, no eventos", () => {
  const hook = fs.readFileSync(path.resolve(__dirname, "useDeclaracionDeEstados.ts"), "utf8");
  expect(hook).not.toMatch(/currentTarget/);
});
