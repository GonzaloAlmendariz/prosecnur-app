import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { piramideDeCuota } from "./piramideDeCuota";

/**
 * La cuota enfrentada, una facultad por fila.
 *
 * La lista ordenada por cumplimiento contesta «qué celda se va a incumplir» y
 * deja las dos celdas de una misma facultad lejos una de otra. La pregunta de
 * campo es la contraria: en esta facultad, ¿de qué lado voy corto?
 */

function celda(facultad: string, sexo: string, meta: number, observadas: number): MonitoreoRow {
  return { faculty: facultad, sex: sexo, target: meta, observed: observadas } as unknown as MonitoreoRow;
}

describe("la pirámide de cuota", () => {
  it("mide cada lado contra SU propia meta", () => {
    // 50 de 100 y 30 de 40 son 50 % y 75 %: sin cada meta, la barra más larga
    // sería la de la izquierda y diría lo contrario de lo que pasa.
    const { facultades } = piramideDeCuota([
      celda("Derecho", "F", 100, 50),
      celda("Derecho", "M", 40, 30),
    ]);
    expect(facultades[0].izquierda?.avance).toBe(50);
    expect(facultades[0].derecha?.avance).toBe(75);
  });

  it("el lado con más celdas declaradas va a la izquierda", () => {
    // El orden no puede depender del alfabeto ni de cómo devolvió las filas el
    // motor: con «Hombre»/«Mujer» el alfabeto pondría a los hombres primero.
    const { izquierda, derecha } = piramideDeCuota([
      celda("Derecho", "Mujer", 100, 50),
      celda("Letras", "Mujer", 100, 50),
      celda("Derecho", "Hombre", 40, 30),
    ]);
    expect(izquierda).toBe("Mujer");
    expect(derecha).toBe("Hombre");
  });

  it("una facultad sin esa celda no se dibuja como un cero", () => {
    // «Sin cuota declarada» y «cuota en cero» son dos cosas distintas.
    const { facultades } = piramideDeCuota([
      celda("Derecho", "F", 100, 50),
      celda("Derecho", "M", 40, 30),
      celda("Letras", "F", 60, 10),
    ]);
    const letras = facultades.find((f) => f.facultad === "Letras");
    expect(letras?.izquierda).not.toBeNull();
    expect(letras?.derecha).toBeNull();
  });

  it("un tercer valor de sexo no desaparece", () => {
    // Una pirámide tiene dos lados; el resto se declara para que la vista lo
    // diga, en vez de perderse en silencio.
    const { otros } = piramideDeCuota([
      celda("Derecho", "F", 100, 50),
      celda("Derecho", "F", 100, 50),
      celda("Derecho", "M", 40, 30),
      celda("Derecho", "Otro", 10, 1),
    ]);
    expect(otros).toEqual(["Otro"]);
  });

  it("ordena por lo que falta en toda la facultad", () => {
    const { facultades } = piramideDeCuota([
      celda("Poco", "F", 10, 8),
      celda("Poco", "M", 10, 9),
      celda("Mucho", "F", 400, 100),
      celda("Mucho", "M", 100, 90),
    ]);
    expect(facultades.map((f) => f.facultad)).toEqual(["Mucho", "Poco"]);
    expect(facultades[0].faltan).toBe(310);
  });

  it("una celda sin meta no entra", () => {
    const res = piramideDeCuota([
      celda("Derecho", "F", 100, 50),
      celda("Derecho", "M", 0, 0),
    ]);
    expect(res.facultades[0].derecha).toBeNull();
    expect(res.sinMeta).toBe(1);
  });
});

it("el gris es para la celda sin recoger, no para la que va atrasada", () => {
  // El control del defecto: la primera celda va al 45 % y la segunda al 56 %.
  // Con el corte inventado en el 50 % la primera salia del color que la paleta
  // define como «todavia sin trabajar» —y tiene 191 respuestas recogidas—, asi
  // que la que iba mas atrasada se leia como la menos urgente. Las dos estan en
  // marcha y las dos tienen que verse igual; el largo de la barra ya dice cual
  // va mas lejos.
  const { facultades } = piramideDeCuota([
    { faculty: "Ciencias", sex: "F", target: 421, observed: 191 },
    { faculty: "Letras", sex: "F", target: 431, observed: 243 },
    { faculty: "Gestion", sex: "F", target: 100, observed: 0 },
  ] as never);

  const lado = (f: string) => facultades.find((x) => x.facultad === f)?.izquierda;
  expect(lado("Ciencias")?.observadas).toBe(191);
  expect(lado("Ciencias")?.cumple).toBe(false);
  expect(lado("Letras")?.cumple).toBe(false);
  // La unica que merece el gris es la que no ha recogido nada.
  expect(lado("Gestion")?.observadas).toBe(0);
});
