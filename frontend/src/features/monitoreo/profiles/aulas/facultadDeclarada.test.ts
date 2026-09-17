import { describe, expect, it } from "vitest";
import {
  codigosOrdenados, codigosSinMapear, etiquetasGuardables,
  propuestaPorOrden, veredictoDelCruce,
} from "./facultadDeclarada";

/**
 * Gonzalo, 2026-09-17: «¿por qué no lo hacemos con el que tenemos ahora, es
 * algo que la app no pueda hacer?». Podía: faltaba dónde pulsarlo. Estas son
 * las decisiones de esa pantalla, que es lo único que puede equivocarse —qué
 * se propone, qué se guarda y cómo se sabe si el mapeo sirve—.
 */

const FACULTADES = [
  "ARQUITECTURA Y URBANISMO", "ARTE Y DISEÑO", "ARTES ESCÉNICAS",
  "CIENCIAS CONTABLES", "CIENCIAS E INGENIERIA",
];

describe("los códigos de la variable", () => {
  it("van en orden NUMÉRICO cuando lo son, no alfabético", () => {
    // Con orden de texto, «10» va antes que «2» y la propuesta por orden
    // empareja mal medio catálogo sin que nada falle.
    expect(codigosOrdenados(["10", "2", "1", "15"])).toEqual(["1", "2", "10", "15"]);
  });
  it("se deduplican y se ignoran los vacíos", () => {
    expect(codigosOrdenados(["1", "1", "", "  ", "2"])).toEqual(["1", "2"]);
  });
  it("si no son números, orden alfabético y ya", () => {
    expect(codigosOrdenados(["b", "a"])).toEqual(["a", "b"]);
  });
});

describe("la propuesta por orden alfabético", () => {
  it("empareja el código n-ésimo con la facultad n-ésima", () => {
    // El cuestionario lista las facultades en alfabético y los códigos van del
    // 1 en adelante: acierta casi siempre, y lo que no acierta se ve y se
    // corrige antes de guardar.
    expect(propuestaPorOrden(["1", "2", "3", "4", "5"], FACULTADES)).toEqual({
      "1": "ARQUITECTURA Y URBANISMO", "2": "ARTE Y DISEÑO",
      "3": "ARTES ESCÉNICAS", "4": "CIENCIAS CONTABLES", "5": "CIENCIAS E INGENIERIA",
    });
  });

  it("NO propone nada si las dos listas no miden lo mismo", () => {
    // Con cuatro códigos y cinco facultades, emparejar por posición corre el
    // catálogo entero desde el primer hueco. Y un catálogo corrido no se ve
    // mal: se ve como un estudio donde nadie coincide con su aula.
    expect(propuestaPorOrden(["1", "2", "3", "4"], FACULTADES)).toEqual({});
    expect(propuestaPorOrden([], FACULTADES)).toEqual({});
  });

  it("ordena las facultades en español, no por código de carácter", () => {
    const p = propuestaPorOrden(["1", "2"], ["ÑANDÚ", "ARTE"]);
    expect(p).toEqual({ "1": "ARTE", "2": "ÑANDÚ" });
  });
});

describe("qué se guarda", () => {
  it("un código sin nombre no traduce nada y no se guarda", () => {
    expect(etiquetasGuardables({ "1": "ARTE", "2": "", "3": "   " }))
      .toEqual({ "1": "ARTE" });
  });
  it("los códigos sin asignar se pueden nombrar, para decirlos en pantalla", () => {
    expect(codigosSinMapear(["1", "2", "3"], { "1": "ARTE" })).toEqual(["2", "3"]);
  });
});

describe("el veredicto del cruce", () => {
  it("un mapeo bueno se declara con su cifra", () => {
    // Medido sobre HSVG2026: con el catálogo correcto, 95,2 %.
    const v = veredictoDelCruce({ ok: true, comparables: 2477, coinciden: 2357 });
    expect(v.tono).toBe("ok");
    expect(v.texto).toContain("95.2 %");
  });

  it("un mapeo corrido se delata y se DICE que es el catálogo, no el campo", () => {
    // Con el catálogo corrido una sola posición, 1,1 %. Sin esta frase, alguien
    // leería «casi nadie coincide con su aula» como un hallazgo de campo
    // catastrófico en vez de como un desplegable mal puesto.
    const v = veredictoDelCruce({ ok: true, comparables: 2477, coinciden: 28 });
    expect(v.tono).toBe("atencion");
    expect(v.texto).toContain("catálogo está mal emparejado");
  });

  it("sin cruce posible no inventa un veredicto: repite el motivo del motor", () => {
    expect(veredictoDelCruce({ ok: false, motivo: "el estudio no declara su variable de facultad" }))
      .toEqual({ tono: "neutro", texto: "el estudio no declara su variable de facultad" });
    expect(veredictoDelCruce(null)).toEqual({ tono: "neutro", texto: "" });
  });

  it("el umbral separa un mapeo roto de un hallazgo real", () => {
    // Justo por encima de la mitad ya no es un mapeo roto: un estudio donde la
    // mayoría estuviera en el aula de otra facultad no tendría cuotas por
    // facultad que valga la pena medir, pero un 55 % sí es campo.
    expect(veredictoDelCruce({ ok: true, comparables: 100, coinciden: 55 }).tono).toBe("ok");
    expect(veredictoDelCruce({ ok: true, comparables: 100, coinciden: 49 }).tono).toBe("atencion");
  });
});
