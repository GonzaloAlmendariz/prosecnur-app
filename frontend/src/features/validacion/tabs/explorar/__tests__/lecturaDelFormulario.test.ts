import { describe, expect, it } from "vitest";
import { normalizarCatalogoCompleto } from "../../../../../api/validacionCatalogo";
import { fraseEnTexto, lecturaDelFormulario } from "../lecturaDelFormulario";

const regla = (id: string, cambios: Record<string, unknown>) => ({
  id, id_motor: id, origen: "formulario", familia: "salto", nombre: id, clase: "inconsistencia", activa: true,
  variable_revisada: "n_hijos", variables: ["n_hijos", "edad"], estado_evaluacion: "evaluada", ...cambios,
});
const EDAD = { pregunta: "edad", etiqueta: "Edad", tipo: "numerica" };
const CATALOGO = normalizarCatalogoCompleto({
  plan_construido: true,
  reglas: [
    regla("S_no", { direccion: "nodebe", frase: [{ pregunta: "n_hijos", etiqueta: "Hijos", tipo: "numerica" }, { texto: " queda vacía cuando " }, EDAD, { texto: " es menor o igual a " }, { valor: "25" }, { texto: "." }] }),
    regla("S_si", { direccion: "debe", frase: [{ pregunta: "n_hijos", etiqueta: "Hijos", tipo: "numerica" }, { texto: " se responde cuando " }, EDAD, { texto: " es mayor que " }, { valor: "25" }, { texto: "." }] }),
    regla("R", { familia: "restriccion", frase: [{ texto: "Se marca cuando " }, { pregunta: "n_hijos", etiqueta: "Hijos", tipo: "numerica" }, { texto: " está fuera del rango de " }, { valor: "0" }, { texto: " a " }, { valor: "12" }, { texto: "." }] }),
    regla("Otra", { variable_revisada: "otra", direccion: "debe", frase: [{ texto: "x cuando " }, { valor: "1" }] }),
  ],
});

describe("lo que el formulario dice de una pregunta, en palabras", () => {
  it("la condición de aparición sale del salto que debe responderse, sin el punto final", () => {
    const l = lecturaDelFormulario(CATALOGO, "n_hijos", "${edad} > 25");
    expect(l.aparece.tipo).toBe("frase");
    expect(l.aparece.tipo === "frase" && fraseEnTexto(l.aparece.piezas)).toBe("edad es mayor que 25");
    expect(l.restricciones.map(fraseEnTexto)).toEqual(["Se marca cuando n_hijos está fuera del rango de 0 a 12."]);
  });

  it("sin regla que la escriba: siempre si no hay condición; si la hay, no se escribe la expresión", () => {
    expect(lecturaDelFormulario(CATALOGO, "edad", null).aparece).toEqual({ tipo: "siempre" });
    expect(lecturaDelFormulario(CATALOGO, "edad", "${x} = '1'").aparece).toEqual({ tipo: "sin-frase" });
    expect(lecturaDelFormulario(null, "n_hijos", "${edad} > 25").aparece).toEqual({ tipo: "sin-frase" });
  });
});
