import { describe, expect, test } from "vitest";

import {
  ANCHO_MINIMO_DEL_ROTULO, anchoAntesDelCorte, cabeElRotuloAplicado,
} from "./rotuloDeZonaCabe";

describe("el rótulo «aplicado» sólo se pinta si cabe", () => {
  test("con el operativo recién arrancado NO cabe: es el caso que se vio roto", () => {
    // 2026-09-09: un día con parte y 15 agendados por delante ponen el corte al
    // 4 % del lienzo, o sea pegado al margen. El rótulo se salía y se montaba
    // sobre el «500» del eje.
    expect(cabeElRotuloAplicado(4)).toBe(false);
    expect(anchoAntesDelCorte(4)).toBe(0);
  });

  test("con la mitad del campo hecho cabe de sobra", () => {
    expect(cabeElRotuloAplicado(50)).toBe(true);
  });

  test("justo en el umbral cabe; un pelo por debajo, no", () => {
    const justo = 4 + ANCHO_MINIMO_DEL_ROTULO;
    expect(cabeElRotuloAplicado(justo)).toBe(true);
    expect(cabeElRotuloAplicado(justo - 0.01)).toBe(false);
  });

  test("se mide contra el MARGEN del lienzo, no contra el cero", () => {
    // El área de dibujo empieza en el 4 %: contar desde 0 daría cuatro puntos de
    // ancho que no existen y el rótulo volvería a salirse.
    expect(anchoAntesDelCorte(10)).toBe(6);
    expect(anchoAntesDelCorte(10, 0)).toBe(10);
  });

  test("un corte imposible no rompe ni deja el rótulo puesto", () => {
    expect(cabeElRotuloAplicado(Number.NaN)).toBe(false);
    expect(anchoAntesDelCorte(1)).toBe(0);
  });
});
