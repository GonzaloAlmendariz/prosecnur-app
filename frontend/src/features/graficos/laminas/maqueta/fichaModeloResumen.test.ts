// ADR 0134: lo que la ficha de la maqueta dice de los gráficos del resumen ejecutivo.
import { describe, expect, it } from "vitest";
import { ajustesDelGlifo, fichaDeRanura } from "./fichaModelo";

const ajustes = (g: string, args: Record<string, unknown>) => ajustesDelGlifo(g, args, false).ajustes;

describe("ficha · resumen ejecutivo (ADR 0134)", () => {
  it("divergentes: nombra la escala del resumen y un orden distinto del de por defecto", () => {
    expect(ajustes("p_barras_divergentes", {})).toEqual([]);
    expect(ajustes("p_barras_divergentes", { estilo: "resumen", orden: "top_two_box" })).toEqual(["Escala con Sin información aparte"]);
    expect(ajustes("p_barras_divergentes", { orden: "sin_informacion" })).toEqual(["Por Sin información"]);
  });

  it("brecha: el contraste con tabla de base y su separador; el separador no se nombra en el recetario", () => {
    expect(ajustes("p_dumbbell", { estilo: "resumen", separar_tras: 6 })).toEqual(["Contraste de públicos", "Separador tras la fila 6"]);
    expect(ajustes("p_dumbbell", { separar_tras: 6 })).toEqual([]);
    expect(ajustes("p_dumbbell", { estilo: "resumen", base_en: "tabla" })).toEqual(["Contraste de públicos", "Base en la tabla"]);
    expect(ajustes("p_dumbbell", { estilo: "resumen", base_en: "auto" })).toEqual(["Contraste de públicos"]);
    expect(ajustes("p_dumbbell", { base_en: "tabla" })).toEqual([]);
  });

  it("panorama: sólo una referencia distinta de 60 se nombra", () => {
    expect(ajustes("p_panorama", {})).toEqual([]);
    expect(ajustes("p_panorama", { referencia: 60 })).toEqual([]);
    expect(ajustes("p_panorama", { referencia: 70 })).toEqual(["Referencia 70 %"]);
  });
});

describe("la ficha de la cobertura", () => {
  it("muestra los públicos como públicos, sin «y N preguntas más»", () => {
    const r = { graficador: "p_cobertura", preguntas: [{ titulo: "Docentes", opciones: [] }, { titulo: "Estudiantes", opciones: [] }, { titulo: "Administrativos", opciones: [] }], bases: [], pinta: "uno", resaltaMayor: false, mismaEscala: true, masPreguntas: 2, twoBox: { ttb: false, btb: false }, args: { bases: ["docentes", "estudiantes", "administrativos"] } } as unknown as Parameters<typeof fichaDeRanura>[0];
    const f = fichaDeRanura(r, "Cobertura y participación");
    expect(f.preguntas).toEqual([]);
    expect(f.publicos).toEqual(["Docentes", "Estudiantes", "Administrativos"]);
  });
});

describe("M3: la ficha de una lámina con regla resume la regla", () => {
  const ranura = (graficador: string, args: Record<string, unknown>) => ({
    graficador, preguntas: [
      { titulo: "Docentes, todas las de escala", opciones: [], bases: ["docentes"], bloque: 0, filas: 1 },
      { titulo: "Estudiantes, todas las de escala", opciones: [], bases: ["estudiantes"], bloque: 0, filas: 1 },
      { titulo: "Administrativos, todas las de escala", opciones: [], bases: ["administrativos"], bloque: 0, filas: 1 },
    ], bases: ["docentes", "estudiantes", "administrativos"], pinta: "uno", resaltaMayor: false, mismaEscala: true, masPreguntas: 2,
    twoBox: { ttb: false, btb: false }, args, bloques: [], tituloPanel: null,
  }) as unknown as Parameters<typeof fichaDeRanura>[0];
  const vars = ["docentes$*", "estudiantes$*", "administrativos$*"];

  it("la escala bajo el umbral dice la regla, no «Docentes, todas las de escala y 2 preguntas más»", () => {
    const f = fichaDeRanura(ranura("p_barras_divergentes", { vars, regla: { tipo: "bajo_umbral", umbral: 60 } }), "Escala");
    expect(f.preguntas).toEqual(["Bajo 60%"]);
  });
  it("con el conteo del motor dice cuántas elige; sin él, la regla sola", () => {
    const r = ranura("p_barras_divergentes", { vars, regla: { tipo: "bajo_umbral", umbral: 60 } });
    expect(fichaDeRanura(r, "Escala", null, 22).preguntas).toEqual(["Las 22 bajo 60%"]);
    expect(fichaDeRanura(r, "Escala", null, null).preguntas).toEqual(["Bajo 60%"]);
  });
  it("el contraste dice cuántas y con qué criterio", () => {
    const f = fichaDeRanura(ranura("p_dumbbell", { regla: { tipo: "mayor_diferencia", n: 13 } }), "Brecha");
    expect(f.preguntas).toEqual(["Las 13 de mayor diferencia"]);
  });
  it("Fortalezas y alertas sin regla guardada resume la que pone el motor", () => {
    const f = fichaDeRanura(ranura("p_fortalezas", { vars: ["docentes$*"], n: 4 }), "Fortalezas");
    expect(f.preguntas).toEqual(["Las 4 más altas y las 4 más bajas"]);
  });
  it("sin regla sigue la lista de preguntas declaradas", () => {
    const f = fichaDeRanura(ranura("p_panorama", { vars }), "Panorama");
    expect(f.preguntas).toEqual(["Docentes, todas las de escala", "Estudiantes, todas las de escala", "Administrativos, todas las de escala"]);
  });
});
