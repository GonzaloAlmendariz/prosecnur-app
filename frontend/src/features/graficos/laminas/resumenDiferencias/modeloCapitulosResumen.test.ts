import { describe, expect, it } from "vitest";
import {
  avisoCapituloResumen,
  avisoFila,
  capituloResumenNuevo,
  conteoResumen,
  escribirCapitulosResumen,
  filasQueSalen,
  leerCapitulosResumen,
  mismosCapitulosResumen,
  notaRestoFila,
  respuestasSumadas,
  sinSuma,
} from "./modeloCapitulosResumen";

// Tal como lo guarda el plan de CCSS (v7.24, lámina ccss-resumen).
const real = [
  { titulo: "Información general", filas: [{ var: "A12_recod", fila: "Mis padres o tutores solventan mis estudios", rotulo: "Sus padres o tutores pagan sus estudios" }] },
  { titulo: "Vida universitaria", filas: [
    { var: "B8_2_4", top2box: ["Todos los días, en momentos puntuales", "Todos los días, a lo largo del día"], rotulo: "Usa Claude todos los días" },
  ] },
  { titulo: "Experiencia laboral", filas: [{ var: "B17", fila: "Fines de semana", rotulo: "Trabaja solo fines de semana", base_rotulo: "que trabajan" }] },
];

describe("capítulos del resumen de diferencias", () => {
  it("lee y vuelve a escribir el plan real sin perder nada", () => {
    const caps = leerCapitulosResumen(real);
    expect(caps.map((c) => c.titulo)).toEqual(["Información general", "Vida universitaria", "Experiencia laboral"]);
    expect(caps[1].filas[0].fila).toBe("");
    expect(escribirCapitulosResumen(caps)).toEqual(real);
    expect(mismosCapitulosResumen(real, caps)).toBe(true);
    expect(filasQueSalen(caps)).toBe(3);
  });

  it("una fila que suma no pide respuesta y dice qué suma; quitar la suma la pide", () => {
    const f = leerCapitulosResumen(real)[1].filas[0];
    expect(avisoFila(f)).toBeNull();
    expect(respuestasSumadas(f)).toBe("Todos los días, en momentos puntuales + Todos los días, a lo largo del día");
    const sola = sinSuma(f);
    expect(respuestasSumadas(sola)).toBe("");
    expect(avisoFila(sola)).toBe("Falta la respuesta: no sale.");
  });

  it("lo que no se edita se nombra y se conserva", () => {
    const f = leerCapitulosResumen(real)[2].filas[0];
    expect(notaRestoFila(f)).toBe("Rótulo de la base: que trabajan. No se edita aquí y se conserva.");
    expect(notaRestoFila(leerCapitulosResumen(real)[1].filas[0])).toBeNull();
  });

  it("lo incompleto avisa y no sale al plan", () => {
    const nuevo = capituloResumenNuevo("c", "f");
    expect(avisoFila(nuevo.filas[0])).toBe("Falta la pregunta, la respuesta y el rótulo: no sale.");
    expect(avisoCapituloResumen(nuevo)).toBe("Ninguna fila completa: el capítulo no sale.");
    expect(avisoCapituloResumen({ ...nuevo, filas: [] })).toBe("Sin filas: el capítulo no sale.");
    expect(escribirCapitulosResumen([...leerCapitulosResumen(real), nuevo])).toEqual(real);
    const sinRotulo = leerCapitulosResumen([{ titulo: "X", filas: [{ var: "B16", fila: "Sí" }] }]);
    expect(avisoFila(sinRotulo[0].filas[0])).toBe("Falta el rótulo: no sale.");
    expect(escribirCapitulosResumen(sinRotulo)).toEqual([]);
  });

  it("acepta un capítulo suelto y descarta lo que no es objeto", () => {
    expect(leerCapitulosResumen({ titulo: "Solo", filas: { var: "B16", fila: "Sí", rotulo: "Trabaja" } })[0].filas).toHaveLength(1);
    expect(leerCapitulosResumen(["x", null, 3])).toEqual([]);
    expect(leerCapitulosResumen(undefined)).toEqual([]);
  });

  it("recorta al escribir y conserva las claves propias del capítulo", () => {
    const caps = leerCapitulosResumen([{ titulo: " T ", nota: "x", filas: [{ var: " B16 ", fila: " Sí ", rotulo: " Trabaja " }] }]);
    expect(escribirCapitulosResumen(caps)).toEqual([{ nota: "x", titulo: "T", filas: [{ var: "B16", fila: "Sí", rotulo: "Trabaja" }] }]);
  });
});

describe("conteo del editor", () => {
  it("dice cuántas filas y en cuántos capítulos salen", () => {
    expect(conteoResumen(0, 0, 0)).toBe("Ninguno");
    expect(conteoResumen(18, 7, 7)).toBe("18 filas en 7 capítulos");
    expect(conteoResumen(1, 1, 1)).toBe("1 fila en 1 capítulo");
    expect(conteoResumen(4, 2, 3)).toBe("4 filas en 2 de 3 capítulos");
    expect(conteoResumen(0, 0, 1)).toBe("Ninguna fila sale");
  });
});
