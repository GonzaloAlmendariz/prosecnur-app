import { describe, expect, it } from "vitest";
import { normalizarCatalogoDeReglas, sinEvaluarDelFormulario } from "./validacionCatalogo";

describe("catálogo de reglas (M3)", () => {
  it("cuenta las del formulario sin evaluar y no inventa la cifra si falta", () => {
    const c = normalizarCatalogoDeReglas({
      plan_construido: true,
      n_total: 5,
      n_sin_evaluar: 3,
      familias: [
        { origen: "formulario", familia: "salto", nombre: "Saltos", n: 3, n_sin_evaluar: 2 },
        { origen: "formulario", familia: "calculo", nombre: "Valores calculados", n: 1, n_sin_evaluar: 0 },
        { origen: "propia", familia: "rango_num", nombre: "Valor fuera de rango", n: 1, n_sin_evaluar: 1 },
      ],
      reglas: [],
    });
    expect(sinEvaluarDelFormulario(c)).toBe(2);
    expect(sinEvaluarDelFormulario(normalizarCatalogoDeReglas({ familias: [{ origen: "formulario" }] }))).toBeNull();
    expect(normalizarCatalogoDeReglas(null).n_total).toBeNull();
  });

  it("junta las preguntas de las frases sin repetir y sin repetir el código como etiqueta", () => {
    const c = normalizarCatalogoDeReglas({
      reglas: [
        { frase: [{ pregunta: "p4", etiqueta: "Año de egreso", tipo: "numerica" }, { texto: " es obligatoria." }] },
        { frase: [{ pregunta: "p4", etiqueta: "Año de egreso", tipo: "numerica" }, { pregunta: "dni", etiqueta: "dni", tipo: "rara" }] },
      ],
    });
    expect(c.preguntas).toEqual([
      { codigo: "p4", etiqueta: "Año de egreso", tipo: "numerica" },
      { codigo: "dni", etiqueta: null, tipo: "texto" },
    ]);
  });
});
