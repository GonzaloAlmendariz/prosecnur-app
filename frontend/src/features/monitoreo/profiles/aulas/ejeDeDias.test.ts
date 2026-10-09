import { describe, expect, it } from "vitest";

import { ejeDeDias, serieSobreElEje } from "./ejeDeDias";

/**
 * El eje que comparten los dos gráficos temporales.
 *
 * Gonzalo: «los días del eje x de cuándo se termina de aplicar el plan tienen
 * que alinearse con el ritmo de recolección. Y ahorita se ve vacío el ritmo».
 */
describe("ejeDeDias", () => {
  it("pone TODOS los días del rango, no sólo los que tienen dato", () => {
    const eje = ejeDeDias("2026-09-07", "2026-09-11");
    expect(eje.map((d) => d.etiqueta)).toEqual(["07/09", "08/09", "09/09", "10/09", "11/09"]);
  });

  it("marca el domingo como día sin campo, pero lo dibuja", () => {
    // 2026-09-13 es domingo. Saltarlo dejaría un hueco de ancho distinto en el
    // eje y los dos gráficos volverían a no cuadrar.
    const eje = ejeDeDias("2026-09-11", "2026-09-14");
    expect(eje.map((d) => d.esDeCampo)).toEqual([true, true, false, true]);
    expect(eje).toHaveLength(4);
  });

  it("separa lo pasado de lo proyectado por el corte del estudio", () => {
    const eje = ejeDeDias("2026-09-07", "2026-09-11", "2026-09-09");
    expect(eje.map((d) => d.pasado)).toEqual([true, true, true, false, false]);
  });

  it("un rango invertido o una fecha ilegible devuelven vacío, no una vista colgada", () => {
    expect(ejeDeDias("2026-09-11", "2026-09-07")).toEqual([]);
    expect(ejeDeDias("ayer", "2026-09-11")).toEqual([]);
  });

  it("el tope corta un horizonte corrupto", () => {
    expect(ejeDeDias("2026-01-01", "2030-01-01").length).toBeLessThanOrEqual(71);
  });
});

describe("serieSobreElEje", () => {
  const eje = ejeDeDias("2026-09-07", "2026-09-11");
  const serie = [
    { fecha: "2026-09-07", validas: 301, acumulado: 301 },
    { fecha: "2026-09-09", validas: 302, acumulado: 603 },
  ];

  it("los días sin dato salen con barra en cero y marcados", () => {
    const cruce = serieSobreElEje(eje, serie);
    expect(cruce.map((d) => d.validas)).toEqual([301, 0, 302, 0, 0]);
    expect(cruce.map((d) => d.tieneDato)).toEqual([true, false, true, false, false]);
  });

  it("el ACUMULADO se arrastra, no cae a cero", () => {
    // Una línea de acumulado que baja a cero el día sin campo y vuelve a subir
    // dice algo falso: lo recogido no se pierde.
    expect(serieSobreElEje(eje, serie).map((d) => d.acumulado)).toEqual([301, 301, 603, 603, 603]);
  });

  it("sin serie, el eje entero queda en cero y ninguno dice tener dato", () => {
    const cruce = serieSobreElEje(eje, []);
    expect(cruce.every((d) => d.validas === 0 && !d.tieneDato)).toBe(true);
  });
});
