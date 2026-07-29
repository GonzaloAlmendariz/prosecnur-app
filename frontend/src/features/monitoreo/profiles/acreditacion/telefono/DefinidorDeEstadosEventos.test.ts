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

const fuente = fs.readFileSync(
  path.resolve(__dirname, "DefinidorDeEstados.tsx"),
  "utf8",
);

describe("los handlers no leen el evento dentro del updater", () => {
  test("ningún setState recibe un updater que use currentTarget", () => {
    // Busca `set…((…) => …event.currentTarget…)`, que es exactamente la forma
    // que falla.
    const updatersConEvento = /set[A-Z]\w*\(\s*\([^)]*\)\s*=>[\s\S]{0,220}?currentTarget/g;
    const hallazgos = fuente.match(updatersConEvento) ?? [];
    expect(hallazgos).toEqual([]);
  });

  test("cada handler captura el valor en una constante antes de actualizar", () => {
    // Las dos superficies que lo sufrieron: color de familia y familia del
    // estado crudo.
    expect(fuente).toMatch(/const elegido = event\.currentTarget\.value;[\s\S]{0,120}setColores/);
    expect(fuente).toMatch(/const elegida = event\.currentTarget\.value[\s\S]{0,140}setAsignaciones/);
  });
});
