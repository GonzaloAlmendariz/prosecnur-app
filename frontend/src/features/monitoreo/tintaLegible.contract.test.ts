import { describe, expect, it } from "vitest";
import {
  COLOR_ACUMULADO,
  COLOR_RESULTADO,
  TINTA_CLARA,
  TINTA_OSCURA,
  contrasteEntre,
  luminanciaDe,
  tintaSobre,
} from "./coloresDeResultado";

/**
 * Lo que este contrato protege es una etiqueta que se dejó de leer en pantalla:
 * el «1355» de Cursos-horario por cobertura y el «79» de Status de aplicación
 * salían con el gris por defecto de Plotly encima de `pendiente`, a 2,66 de
 * contraste. La regla no es «elige bien»: es que ningún color de la paleta
 * quede por debajo del piso declarado.
 */

/**
 * 4,3 y no 4,5: ver la nota de `tintaSobre`. Tres colores de la paleta tocan
 * techo en 4,37 y subirlos es recolorear la identidad, no ajustar este helper.
 * Si algún día la paleta se oscurece, este número sube — no baja.
 */
const PISO_DE_CONTRASTE = 4.3;

describe("la tinta encima de una barra se lee", () => {
  it("ningún color de resultado queda por debajo del piso", () => {
    const medidos = Object.entries(COLOR_RESULTADO).map(([nombre, relleno]) => ({
      nombre,
      contraste: Number(contrasteEntre(tintaSobre(relleno), relleno).toFixed(2)),
    }));
    const flojos = medidos.filter((m) => m.contraste < PISO_DE_CONTRASTE);
    expect(flojos).toEqual([]);
  });

  it("elige la tinta oscura sobre un relleno claro y la clara sobre uno oscuro", () => {
    expect(tintaSobre(COLOR_RESULTADO.pendiente)).toBe(TINTA_OSCURA);
    expect(tintaSobre(COLOR_RESULTADO.revision)).toBe(TINTA_CLARA);
    expect(tintaSobre(COLOR_ACUMULADO)).toBe(TINTA_CLARA);
  });

  it("mejora el caso que se reportó desde la pantalla", () => {
    // #444 es el gris que Plotly pone cuando nadie se lo dice.
    const antes = contrasteEntre("#444444", COLOR_RESULTADO.pendiente);
    const ahora = contrasteEntre(tintaSobre(COLOR_RESULTADO.pendiente), COLOR_RESULTADO.pendiente);
    expect(antes).toBeLessThan(3);
    expect(ahora).toBeGreaterThan(antes);
  });

  it("un hex inválido no revienta ni finge un color", () => {
    expect(luminanciaDe("no-es-un-color")).toBe(0);
    expect(luminanciaDe("#12345")).toBe(0);
  });

  it("el contraste es simétrico y sus extremos son los conocidos", () => {
    expect(contrasteEntre("#ffffff", "#000000")).toBeCloseTo(21, 1);
    expect(contrasteEntre("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrasteEntre("#7a8796", "#7a8796")).toBeCloseTo(1, 5);
  });
});
