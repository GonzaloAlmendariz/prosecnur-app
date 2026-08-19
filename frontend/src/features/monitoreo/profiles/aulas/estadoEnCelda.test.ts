import { describe, expect, it } from "vitest";

import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { colorDeEstado, esColumnaDeEstado } from "./EstadoEnCelda";

// Dos criterios para la misma pregunta: la capa de presentación traduce como
// estado `status`, cualquier `*_status` y cualquier `*_state`; el chip conocía
// sólo cuatro claves literales. Medido sobre el corte, la columna «Estado» de
// Cuotas tenía **40 celdas sin chip de 40**, porque su clave es `status` a secas.
//
// Y el vocabulario de las cuotas no tenía colores propios: `pendiente` los
// heredaba por el rótulo alterno de su tramo, pero `cumplida`, `en_riesgo` y
// `sin_meta` no. Una columna donde sólo se colorea la mala noticia se lee peor
// que una sin color.

describe("el chip pregunta lo mismo que la traducción", () => {
  it.each(["status", "sample_status", "application_status", "operational_status", "application_state"])(
    "%s es columna de estado",
    (campo) => {
      expect(esColumnaDeEstado(campo)).toBe(true);
    },
  );

  it.each(["facultad", "meta", "observadas", "link", "motivo"])("%s no lo es", (campo) => {
    expect(esColumnaDeEstado(campo)).toBe(false);
  });

  it("un rol no es un estado y se queda sin color", () => {
    // `sample_role` sí lo traduce la presentación, pero un ROL no es un
    // desenlace: colorearlo con la paleta de resultados diría otra cosa.
    expect(esColumnaDeEstado("sample_role")).toBe(false);
    expect(colorDeEstado("Titular")).toBeNull();
  });
});

describe("el vocabulario de cuotas tiene sus colores", () => {
  it.each([
    ["Pendiente", COLOR_RESULTADO.pendiente],
    ["Cumplida", COLOR_RESULTADO.efectiva],
    ["En riesgo", COLOR_RESULTADO.parcial],
    ["Sin meta", COLOR_RESULTADO.revision],
  ])("%s se pinta con el color compartido", (etiqueta, color) => {
    expect(colorDeEstado(etiqueta)).toBe(color);
  });

  it("los cuatro son colores distintos entre sí", () => {
    const colores = ["Pendiente", "Cumplida", "En riesgo", "Sin meta"].map(colorDeEstado);
    expect(new Set(colores).size).toBe(4);
  });

  it("lo que no reconoce sigue sin colorearse", () => {
    // Es la garantía que hace segura la regla ancha de arriba.
    expect(colorDeEstado("Cualquier cosa")).toBeNull();
    expect(colorDeEstado("")).toBeNull();
  });
});
