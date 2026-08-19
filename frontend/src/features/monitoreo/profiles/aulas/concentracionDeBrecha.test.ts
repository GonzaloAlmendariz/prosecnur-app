import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { concentracionDeBrecha } from "./concentracionDeBrecha";

const fila = (brecha: number) => ({ brecha } as unknown as MonitoreoRow);

describe("concentracionDeBrecha", () => {
  it("dice cuántas aulas cubren la mitad de lo que falta", () => {
    // 100 + 100 = 200 de 400: dos aulas cubren la mitad exacta.
    const r = concentracionDeBrecha([fila(100), fila(100), fila(100), fila(100)]);
    expect(r.falta).toBe(400);
    expect(r.aulasParaLaMitad).toBe(2);
  });

  it("distingue una brecha concentrada de una repartida", () => {
    const concentrada = concentracionDeBrecha([fila(90), ...Array(20).fill(0).map(() => fila(1))]);
    const repartida = concentracionDeBrecha(Array(21).fill(0).map(() => fila(10)));
    // Una aula cubre casi todo en la concentrada; en la repartida hacen falta 11.
    expect(concentrada.aulasParaLaMitad).toBe(1);
    expect(repartida.aulasParaLaMitad).toBe(11);
  });

  it("no cuenta las aulas sin brecha", () => {
    const r = concentracionDeBrecha([fila(10), fila(0), fila(5)]);
    expect(r.aulas).toBe(2);
    expect(r.falta).toBe(15);
  });

  it("sin brecha devuelve vacío en vez de dividir entre cero", () => {
    const r = concentracionDeBrecha([fila(0), fila(0)]);
    expect(r.falta).toBe(0);
    expect(r.tramos).toEqual([]);
  });
});

describe("la lectura usa la unidad que el resto de la pestaña declara", () => {
  // En «Consultas > Brechas» conviven, a tres líneas:
  //
  //   BRECHAS 168 · cursos-horario por debajo de su meta   (el tile)
  //   Cursos-horario con brecha · 168 filas                (el título)
  //   «69 de 168 aulas concentran la mitad de lo que falta» (la lectura)
  //
  // En este perfil no son sinónimos: 210 partes, 196 aulas, 236 cursos-horario.
  // Los campos del modelo se siguen llamando `aulas` por historia; lo que se lee
  // en pantalla es la unidad de verdad.
  const componente = fs.readFileSync(
    path.resolve(__dirname, "AulasConcentracionBrecha.tsx"),
    "utf8",
  );
  // Sólo el JSX: los comentarios explican justamente el defecto y nombran la
  // palabra vieja.
  const visible = componente
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  it("se aisló el texto visible", () => {
    expect(visible).toContain("concentran la");
  });

  it("la lectura y la etiqueta accesible dicen cursos-horario", () => {
    expect(visible).toContain("cursos-horario concentran la");
    expect(visible).toContain("cursos-horario cubren el");
  });

  it("no queda copy que los llame aulas", () => {
    expect(visible).not.toMatch(/\baulas\s+(concentran|cubren|con más brecha)/);
  });
});
