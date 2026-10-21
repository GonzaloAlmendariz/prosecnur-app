// Checklist A5 (matriz HSyVbG, 2026-10-21): el código que va a la categoría
// equivocada se avisa; las dummies y las variantes de redacción no.
import { describe, expect, test } from "vitest";
import type { EquivalenciaFila, VariableDeBase } from "../../api/equivalencias";
import { codigosMalUbicados, malUbicadosEnMapa } from "./codigosMalUbicadosModel";
import { indicadorDeEscala } from "./preguntaEquivalenteModel";
import { nombreDeSerieDeBases } from "./nombreDeSerie";

const escalaIngreso = [
  { codigo: "1", etiqueta: "Ingresantes hasta 2019" },
  { codigo: "2", etiqueta: "Ingresantes en 2020-2021" },
  { codigo: "3", etiqueta: "Ingresantes desde 2022" },
];

const variable = (name: string, opciones: [string, string][]): VariableDeBase => ({
  name, label: name, seccion: "", firma: opciones.map(([c, e]) => `${c}=${e}`).join("|"),
  opciones: opciones.map(([codigo, etiqueta]) => ({ codigo, etiqueta })),
});

const catalogo: Record<string, VariableDeBase[]> = {
  "2024": [variable("cruce_8", [["1", "Ingresantes hasta 2019"], ["2", "Ingresantes en 2020-2021"], ["3", "Ingresantes desde 2022"]])],
  "2025": [variable("P8_recod", [["1", "Ingresantes desde 2023"], ["2", "Ingresantes en 2021–2022"], ["3", "Ingresantes hasta 2020"]])],
};

const fila = (mapa25: Record<string, string>): EquivalenciaFila => ({
  seccion: "", etiqueta_estandar: "Año de ingreso", cantidad: 2,
  variables: { "2024": "cruce_8", "2025": "P8_recod" },
  armonizacion: { escala: escalaIngreso, por_base: { "2024": { comparable: true, mapa: {} }, "2025": { comparable: true, mapa: mapa25 } } },
});

describe("códigos mal ubicados", () => {
  test("la lista de 2025 en orden inverso con el mapa identidad se acusa en sus dos extremos", () => {
    const mal = codigosMalUbicados(fila({}), ["2024", "2025"], catalogo);
    expect(mal.map((m) => [m.base, m.codigo, m.sugerida])).toEqual([
      ["2025", "1", "Ingresantes desde 2022"],
      ["2025", "3", "Ingresantes hasta 2019"],
    ]);
  });

  test("escalas de intensidad: una versión más corta de la misma respuesta no se sugiere", () => {
    const likert = [
      { codigo: "1", etiqueta: "Muy de acuerdo" }, { codigo: "2", etiqueta: "De acuerdo" },
      { codigo: "3", etiqueta: "En desacuerdo" }, { codigo: "4", etiqueta: "Muy en desacuerdo" },
    ];
    expect(malUbicadosEnMapa("b", [
      { codigo: "1", etiqueta: "Totalmente de acuerdo", destino: "1" },
      { codigo: "4", etiqueta: "Totalmente en desacuerdo", destino: "4" },
    ], likert)).toEqual([]);
    const satisf = [
      { codigo: "1", etiqueta: "Muy satisfecho" }, { codigo: "2", etiqueta: "Satisfecho" },
      { codigo: "3", etiqueta: "Insatisfecho" }, { codigo: "4", etiqueta: "Muy insatisfecho" },
    ];
    expect(malUbicadosEnMapa("b", [{ codigo: "1", etiqueta: "Bastante satisfecho", destino: "1" }], satisf)).toEqual([]);
    // Una inversión real entre etiquetas del mismo largo sí se acusa.
    const ciclos = [{ codigo: "1", etiqueta: "1º ciclo" }, { codigo: "2", etiqueta: "2º ciclo" }];
    expect(malUbicadosEnMapa("b", [
      { codigo: "1", etiqueta: "2º ciclo", destino: "1" }, { codigo: "2", etiqueta: "1º ciclo", destino: "2" },
    ], ciclos).map((m) => m.codigo)).toEqual(["1", "2"]);
  });

  test("un mapa declarado código por código es una decisión: no se revisa", () => {
    expect(codigosMalUbicados(fila({ "1": "1", "2": "2", "3": "3" }), ["2024", "2025"], catalogo)).toEqual([]);
  });

  test("con el mapa invertido ya declarado no queda nada que avisar", () => {
    expect(codigosMalUbicados(fila({ "1": "3", "2": "2", "3": "1" }), ["2024", "2025"], catalogo)).toEqual([]);
  });

  test("una dummy, una variante de redacción y una agrupación no se acusan", () => {
    expect(malUbicadosEnMapa("b", [{ codigo: "1", etiqueta: "Sí", destino: "1" }], [{ codigo: "1", etiqueta: "Angustia" }])).toEqual([]);
    const escala = [{ codigo: "1", etiqueta: "Presenta discapacidad" }, { codigo: "2", etiqueta: "No presenta discapacidad" }];
    expect(malUbicadosEnMapa("b", [{ codigo: "1", etiqueta: "Sí", destino: "1" }, { codigo: "2", etiqueta: "No", destino: "2" }], escala)).toEqual([]);
    const lugar = [{ codigo: "1", etiqueta: "Lima" }, { codigo: "2", etiqueta: "Otras regiones" }];
    expect(malUbicadosEnMapa("b", [
      { codigo: "7", etiqueta: "Lima Metropolitana", destino: "1" },
      { codigo: "15", etiqueta: "Callao", destino: "1" },
    ], lugar)).toEqual([]);
  });

  test("la columna Escala lo dice aunque la fila esté armonizada", () => {
    const ind = indicadorDeEscala(fila({}), ["2024", "2025"], catalogo, nombreDeSerieDeBases(["2024", "2025"]));
    expect(ind.tono).toBe("aviso");
    expect(ind.texto).toBe("Revisar mapa en 2025");
    expect(ind.explicacion).toContain("«Ingresantes desde 2023» se cuenta como «Ingresantes hasta 2019»");
  });
});
