import { describe, expect, test } from "vitest";
import { desplazamientoParaMostrar } from "./encuadreNodo";

// Lienzo de 1000 x 600 cuyo tercio derecho tapa el panel del nodo: el área útil son los 700 px de la izquierda.
const AREA = { x: 0, y: 0, ancho: 700, alto: 600 };

describe("encuadre del nodo elegido en el Mapa", () => {
  test("un nodo ya visible a la izquierda del panel no mueve el lienzo", () => {
    expect(desplazamientoParaMostrar({ x: 100, y: 100, ancho: 300, alto: 88 }, AREA, 32)).toBeNull();
  });

  test("un nodo bajo el panel se trae completo a su izquierda, con aire", () => {
    expect(desplazamientoParaMostrar({ x: 820, y: 90, ancho: 300, alto: 88 }, AREA, 32)).toEqual({ dx: -452, dy: 0 });
  });

  test("un nodo cortado arriba o a la izquierda baja o se corre lo justo", () => {
    expect(desplazamientoParaMostrar({ x: -50, y: 10, ancho: 300, alto: 88 }, AREA, 32)).toEqual({ dx: 82, dy: 22 });
  });

  test("un nodo más ancho que el área alinea su comienzo", () => {
    expect(desplazamientoParaMostrar({ x: 400, y: 100, ancho: 900, alto: 88 }, AREA, 32)).toEqual({ dx: -368, dy: 0 });
  });
});
