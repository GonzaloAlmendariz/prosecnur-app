import { describe, expect, it } from "vitest";
import { partirRotulo, type Medidor } from "./rotuloDeNodo";

// 10 px por carácter: el ancho de un renglón es su largo × 10.
const medir: Medidor = (t) => t.length * 10;

describe("rótulos de los nodos de Construcción", () => {
  it("un rótulo que cabe queda en una línea", () => {
    expect(partirRotulo("Recepción", 120, medir, 2)).toEqual(["Recepción"]);
  });

  it("parte por palabras hasta el máximo de líneas", () => {
    expect(partirRotulo("Experiencia en el sitio", 120, medir, 2)).toEqual(["Experiencia", "en el sitio"]);
    // «en el Espacio» mide 130: el recorte guarda los caracteres que caben con la elipsis.
    expect(partirRotulo("Experiencia en el Espacio", 120, medir, 2)).toEqual(["Experiencia", "en el Espac…"]);
  });

  it('lo que no cabe termina en "…" y ninguna línea pasa del ancho', () => {
    const lineas = partirRotulo("Recepción y/o registro inicial en Espacio de Protección de ${sede_ppl}", 120, medir, 2);
    expect(lineas).toHaveLength(2);
    expect(lineas[1].endsWith("…")).toBe(true);
    for (const l of lineas) expect(medir(l)).toBeLessThanOrEqual(120);
  });

  it("una palabra sola más ancha que el renglón se recorta", () => {
    const [linea] = partirRotulo("Supercalifragilístico", 80, medir, 1);
    expect(linea.endsWith("…")).toBe(true);
    expect(medir(linea)).toBeLessThanOrEqual(80);
  });

  it("los espacios sobrantes no cuentan y un vacío da una línea vacía", () => {
    expect(partirRotulo("  Uno   dos  ", 200, medir, 2)).toEqual(["Uno dos"]);
    expect(partirRotulo("", 200, medir, 2)).toEqual([""]);
  });
});
