import { describe, expect, test } from "vitest";
import { normalizePresetsRegistry } from "./metadataSanitizers";

// El bloque `calculos` viaja desde el motor (`graficos_calculos_gobernados.R`)
// hasta la pestaña «Cálculos». El normalizador reconstruye cada preset campo a
// campo, así que un campo nuevo que no se agregue aquí se pierde en silencio y
// el bug aparece recién al abrir la pestaña, vacía y sin error. Estos tests son
// el gate de esa cadena.

const presetBase = (calculos: unknown) => ({
  presets: [
    {
      name: "barras_apiladas",
      titulo_humano: "Barras apiladas",
      descripcion: "",
      icono_ui: "Rows3",
      args: [],
      calculos,
    },
  ],
});

describe("normalizePresetsRegistry · bloque calculos", () => {
  test("conserva la clasificación que manda el motor", () => {
    const r = normalizePresetsRegistry(
      presetBase({
        familia_porcentaje: true,
        cierra_100: true,
        admite_metodo: true,
        campo_decimales: "decimales",
      }),
    );

    expect(r.presets[0].calculos).toEqual({
      familia_porcentaje: true,
      cierra_100: true,
      admite_metodo: true,
      campo_decimales: "decimales",
    });
  });

  test("una familia sin bloque queda fuera de la matriz", () => {
    const r = normalizePresetsRegistry(presetBase(undefined));
    expect(r.presets[0].calculos).toBeUndefined();
  });

  test("sin campo de decimales no hay fila que editar", () => {
    // `campo_decimales` es el único dato sin el cual la fila no podría hacer
    // nada: se descarta el bloque entero en vez de pintar un control muerto.
    const r = normalizePresetsRegistry(
      presetBase({ familia_porcentaje: true, cierra_100: true, admite_metodo: true }),
    );
    expect(r.presets[0].calculos).toBeUndefined();
  });

  test("no se ofrece elegir método a quien no cierra en 100 %", () => {
    // Aunque el backend mandara `admite_metodo: true` por error, sin cierre a
    // 100 % no hay resto que repartir y el control sería un mando muerto.
    const r = normalizePresetsRegistry(
      presetBase({
        familia_porcentaje: true,
        cierra_100: false,
        admite_metodo: true,
        campo_decimales: "valores_decimales",
      }),
    );
    expect(r.presets[0].calculos?.admite_metodo).toBe(false);
    expect(r.presets[0].calculos?.cierra_100).toBe(false);
  });

  test("valores basura no rompen la carga del catálogo", () => {
    for (const basura of ["", 0, [], "no", null]) {
      const r = normalizePresetsRegistry(presetBase(basura));
      expect(r.presets[0].calculos).toBeUndefined();
    }
  });
});
