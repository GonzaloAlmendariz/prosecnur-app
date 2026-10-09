import { describe, expect, it } from "vitest";

import {
  etiquetaDeValor, etiquetaDeValorEnGrafico, etiquetaDelEje, etiquetaPluralDelEje,
  etiquetaSinValorDelEje,
} from "./etiquetaDelEje";

const FACULTAD = { clave: "facultad", etiqueta: "Facultad", etiqueta_plural: "Facultades", etiqueta_sin: "Sin facultad" };
const NIVEL = { clave: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles", etiqueta_sin: "Sin nivel" };

describe("los rótulos salen del eje, no del código", () => {
  it("singular, plural y el «sin»", () => {
    expect(etiquetaDelEje(NIVEL)).toBe("Nivel");
    expect(etiquetaPluralDelEje(NIVEL)).toBe("Niveles");
    // Importa que el «sin» salga del eje: es una fila que el usuario VE, y
    // llamarla «Sin facultad» en un estudio por nivel mentiría sobre qué falta.
    expect(etiquetaSinValorDelEje(NIVEL)).toBe("Sin nivel");
  });

  it("sin eje declarado, todo dice facultad — que es lo que era", () => {
    for (const vacio of [null, undefined, {}, { etiqueta: "  " }]) {
      expect(etiquetaDelEje(vacio)).toBe("Facultad");
      expect(etiquetaPluralDelEje(vacio)).toBe("Facultades");
      expect(etiquetaSinValorDelEje(vacio)).toBe("Sin facultad");
    }
  });
});

describe("etiquetaDeValor", () => {
  it("la facultad se acorta, como ya se acortaba", () => {
    // Delega en `facultadCorta`: no hay tabla nueva, y por eso este valor es el
    // mismo que ya publican los gráficos.
    expect(etiquetaDeValor("CIENCIAS E INGENIERIA", "facultad", FACULTAD)).toBe("CC. e Ingeniería");
    expect(etiquetaDeValor("EDUCACION", "facultad", FACULTAD)).toBe("Educación");
  });

  it("el nivel se dice con su palabra, porque un número suelto no dice de qué es", () => {
    expect(etiquetaDeValor("7", "nivel", NIVEL)).toBe("Nivel 7");
    // Y no se repite si el valor ya la trae: pasa cuando alguien la escribe en
    // el marco.
    expect(etiquetaDeValor("Nivel 7", "nivel", NIVEL)).toBe("Nivel 7");
    expect(etiquetaDeValor("nivel 7", "nivel", NIVEL)).toBe("nivel 7");
  });

  it("la carrera se normaliza pero NO se acorta: cabe", () => {
    expect(etiquetaDeValor("ECONOMÍA", "carrera", NIVEL)).toBe("Economía");
    expect(etiquetaDeValor("CIENCIA POLÍTICA Y GOBIERNO", "carrera", NIVEL))
      .toBe("Ciencia Política y Gobierno");
  });

  it("el sexo va en palabras, reusando el traductor del perfil", () => {
    expect(etiquetaDeValor("F", "sexo", NIVEL)).toBe("Mujeres");
    expect(etiquetaDeValor("M", "sexo", NIVEL)).toBe("Hombres");
    // Un valor que no se reconoce no se traduce a un sexo que nadie declaró.
    expect(etiquetaDeValor("X", "sexo", NIVEL)).toBe("X");
  });

  it("sin dimensión, la del eje", () => {
    expect(etiquetaDeValor("7", null, NIVEL)).toBe("Nivel 7");
    expect(etiquetaDeValor("DERECHO", null, FACULTAD)).toBe("Derecho");
    expect(etiquetaDeValor("DERECHO", null, null)).toBe("Derecho");
  });

  it("un valor vacío no se convierte en un rótulo", () => {
    // Lo contrario daría «Nivel » en una leyenda, que es peor que una celda
    // vacía: parece un dato.
    for (const v of ["", "   ", null, undefined]) {
      expect(etiquetaDeValor(v, "nivel", NIVEL)).toBe("");
    }
  });
});

describe("etiquetaDeValorEnGrafico: no cambia lo que ya se pinta", () => {
  it("con el eje en FACULTAD devuelve el valor crudo", () => {
    // Los tres gráficos de Metas pintan el nombre tal cual y su reparto en
    // líneas está afinado contra esos anchos, contando píxeles sobre las quince
    // facultades. Mejorarlos de paso («Arte y Diseño») descuadraría ese ajuste y
    // cambiaría etiquetas que HSVG ya tiene en pantalla: es una decisión de
    // diseño, no un efecto colateral de generalizar el eje.
    expect(etiquetaDeValorEnGrafico("ARTE Y DISEÑO", FACULTAD)).toBe("ARTE Y DISEÑO");
    expect(etiquetaDeValorEnGrafico("CIENCIAS E INGENIERIA")).toBe("CIENCIAS E INGENIERIA");
    expect(etiquetaDeValorEnGrafico("ARTE Y DISEÑO", null)).toBe("ARTE Y DISEÑO");
  });

  it("con cualquier otro eje lo dice con su palabra", () => {
    // Es lo que este cambio viene a resolver: un «7» suelto en el pie de un
    // gráfico se lee como una cifra, no como un nombre.
    expect(etiquetaDeValorEnGrafico("7", NIVEL)).toBe("Nivel 7");
  });

  it("un valor vacío no se convierte en un rótulo", () => {
    for (const v of ["", "  ", null, undefined]) {
      expect(etiquetaDeValorEnGrafico(v, NIVEL)).toBe("");
      expect(etiquetaDeValorEnGrafico(v, FACULTAD)).toBe("");
    }
  });
});
