import { describe, expect, it } from "vitest";
import {
  avisoCapitulo,
  avisoHallazgo,
  capituloNuevo,
  escribirCapitulos,
  hallazgoCompleto,
  leerCapitulos,
  leerComparacion,
  mismosCapitulos,
  mover,
  notaRestoHallazgo,
} from "./modeloCapitulosHallazgos";

// El ejemplo real del plan de CCSS (revisión del PPT v7.11, ítem 2).
const real = [{ titulo: "Información general", cifras: [{ var: "A11_recod", fila: "Privado", texto: "estudió la secundaria en un colegio privado", comparacion: "auto" }] }];

describe("capítulos del resumen ejecutivo: lectura y escritura", () => {
  it("lo guardado vuelve igual al plan (ida y vuelta sin pérdida)", () => {
    expect(escribirCapitulos(leerCapitulos(real))).toEqual(real);
    expect(mismosCapitulos(real, leerCapitulos(real))).toBe(true);
  });

  it("conserva lo que el editor no maneja, en el capítulo y en el hallazgo", () => {
    const valor = [{ titulo: "Trabajo", nota: "x", cifras: [{
      var: "e$P5", sumar: ["Sí, siempre", "A veces"], filtros: { sexo: "Mujer" }, base_texto: "Base: mujeres", base_rotulo: "mujeres",
      raro: 1, texto: "trabaja", comparacion: "ninguna",
    }] }];
    const [c] = leerCapitulos(valor);
    expect(c.resto).toEqual({ nota: "x" });
    // Con `sumar` no hace falta la respuesta: el hallazgo está completo.
    expect(hallazgoCompleto(c.hallazgos[0])).toBe(true);
    const editado = escribirCapitulos([{ ...c, hallazgos: [{ ...c.hallazgos[0], texto: "trabaja y estudia" }] }]);
    expect(editado).toEqual([{ ...valor[0], cifras: [{ ...valor[0].cifras[0], texto: "trabaja y estudia" }] }]);
    expect(notaRestoHallazgo(c.hallazgos[0].resto)).toBe(
      "Suma: Sí, siempre + A veces. Filtros propios. Base: Base: mujeres. Rótulo de la base: mujeres. Otros campos guardados: raro. No se edita aquí y se conserva.",
    );
    expect(notaRestoHallazgo({})).toBeNull();
  });

  it("acepta un capítulo suelto y descarta lo que no es objeto", () => {
    expect(leerCapitulos({ titulo: "A", cifras: { var: "q1", fila: "Sí", texto: "t" } })[0].hallazgos).toHaveLength(1);
    expect(leerCapitulos(["x", null, 3])).toEqual([]);
    expect(leerCapitulos(undefined)).toEqual([]);
  });

  it("la comparación: automática, ninguna o escrita a mano", () => {
    expect(leerComparacion(undefined).comparacion).toBe("auto");
    expect(leerComparacion(true).comparacion).toBe("auto");
    expect(leerComparacion(false).comparacion).toBe("ninguna");
    expect(leerComparacion("ninguna").comparacion).toBe("ninguna");
    expect(leerComparacion("12 puntos más que en 2025")).toEqual({ comparacion: "escrita", comparacionTexto: "12 puntos más que en 2025" });
    const [c] = leerCapitulos([{ titulo: "A", cifras: [{ var: "q", fila: "Sí", texto: "t", comparacion: "más que el resto" }] }]);
    expect(escribirCapitulos([c])[0].cifras).toEqual([{ var: "q", fila: "Sí", texto: "t", comparacion: "más que el resto" }]);
  });
});

describe("lo incompleto no sale al plan", () => {
  it("un hallazgo sin pregunta, respuesta o texto lleva su aviso y no se escribe", () => {
    const c = capituloNuevo("c1", "h1");
    expect(avisoHallazgo(c.hallazgos[0])).toBe("Falta la pregunta, la respuesta y el texto: no sale.");
    expect(avisoHallazgo({ ...c.hallazgos[0], var: "q", fila: "Sí" })).toBe("Falta el texto: no sale.");
    expect(avisoHallazgo({ ...c.hallazgos[0], var: "q", fila: "Sí", texto: "t", comparacion: "escrita" })).toBe("Falta la comparación escrita: no sale.");
    expect(escribirCapitulos([c])).toEqual([]);
    expect(avisoCapitulo(c, "resumen")).toBe("Ningún hallazgo completo: el capítulo no sale.");
    expect(avisoCapitulo({ ...c, hallazgos: [] }, "resumen")).toBe("Sin hallazgos: el capítulo no sale.");
  });

  it("de un capítulo sólo salen sus hallazgos completos; en «titulares» se pide el titular sin bloquear", () => {
    const [c] = leerCapitulos(real);
    const conIncompleto = { ...c, hallazgos: [...c.hallazgos, capituloNuevo("x", "y").hallazgos[0]] };
    expect(escribirCapitulos([conIncompleto])).toEqual(real);
    expect(avisoCapitulo(c, "resumen")).toBeNull();
    expect(avisoCapitulo(c, "titulares")).toBe("Sin titular, la lámina usa la frase del primer hallazgo.");
    // El titular se conserva aunque el modo no lo use.
    expect(escribirCapitulos([{ ...c, titular: "Siete de cada diez" }])[0].titular).toBe("Siete de cada diez");
  });

  it("agregar un capítulo vacío no cambia lo que dice el plan", () => {
    expect(mismosCapitulos(real, [...leerCapitulos(real), capituloNuevo("c9", "h9")])).toBe(true);
  });
});

describe("orden", () => {
  it("sube y baja dentro de la lista; en los extremos no cambia", () => {
    expect(mover(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(mover(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(mover(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(mover(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
});
