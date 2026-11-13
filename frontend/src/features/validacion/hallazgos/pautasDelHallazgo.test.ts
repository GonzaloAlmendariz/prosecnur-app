import { describe, expect, it } from "vitest";
import { pautasDelHallazgo, situacionDeOpcion, subtipoDeLosCasos, tipoDePauta, todasLasPautas } from "./pautasDelHallazgo";
import { opcionesDeTratamiento } from "./modeloHallazgos";

const sinNada = { vista: "general" as const, familia: null, direccion: null, subtipo: null, tipoRegla: null };

describe("tipo de pauta", () => {
  it("la familia del catálogo manda", () => {
    expect(tipoDePauta({ ...sinNada, familia: "rango_num" })).toBe("rango");
    expect(tipoDePauta({ ...sinNada, familia: "bateria" })).toBe("bateria");
    expect(tipoDePauta({ ...sinNada, familia: "comparar_fechas" })).toBe("fechas");
    expect(tipoDePauta({ ...sinNada, familia: "formato" })).toBe("formato");
    expect(tipoDePauta({ ...sinNada, familia: "fuera_catalogo" })).toBe("fuera_de_lista");
    expect(tipoDePauta({ ...sinNada, familia: "coherencia_2v" })).toBe("coherencia");
    expect(tipoDePauta({ ...sinNada, familia: "no_nulo" })).toBe("obligatoria");
  });

  it("un salto se separa por dirección: vacía donde correspondía o respondida donde no", () => {
    expect(tipoDePauta({ ...sinNada, vista: "salto", familia: "salto", direccion: "debe" })).toBe("salto_vacia");
    expect(tipoDePauta({ ...sinNada, vista: "salto", familia: "salto", direccion: "nodebe" })).toBe("salto_sobra");
    expect(tipoDePauta({ ...sinNada, tipoRegla: "skip", subtipo: "salto_nodebe" })).toBe("salto_sobra");
    // Sin dirección no se adivina.
    expect(tipoDePauta({ ...sinNada, vista: "salto", familia: "salto" })).toBeNull();
  });

  it("sin familia usa el subtipo del enunciado y luego el tipo de regla", () => {
    expect(tipoDePauta({ ...sinNada, subtipo: "faltante" })).toBe("obligatoria");
    expect(tipoDePauta({ ...sinNada, subtipo: "catalogo" })).toBe("fuera_de_lista");
    expect(tipoDePauta({ ...sinNada, tipoRegla: "range" })).toBe("rango");
  });

  it("los pares casi iguales tienen su pauta por la vista", () => {
    expect(tipoDePauta({ ...sinNada, vista: "casi-iguales", familia: "casi_iguales" })).toBe("casi_iguales");
  });

  it("un tipo desconocido no recibe pautas genéricas", () => {
    expect(tipoDePauta({ ...sinNada, familia: "grupo_repetido" })).toBeNull();
    expect(pautasDelHallazgo({ ...sinNada, familia: "grupo_repetido", semillaOrigen: null })).toBeNull();
  });
});

describe("pautas del hallazgo", () => {
  it("la batería dice cómo sospechar un llenado sin leer", () => {
    const p = pautasDelHallazgo({ ...sinNada, familia: "bateria", semillaOrigen: null });
    expect(p?.revisar[0]).toMatch(/entrevista corta/);
    expect(p?.situaciones.excluir).toBeTruthy();
  });

  it("la fecha ilegible manda a la ficha física", () => {
    const p = pautasDelHallazgo({ ...sinNada, familia: "rango_fecha", semillaOrigen: null });
    expect(p?.revisar.some((r) => /ficha física/.test(r))).toBe(true);
  });

  it("una regla del detector antepone su pauta y conserva la del tipo", () => {
    const p = pautasDelHallazgo({ ...sinNada, familia: "coherencia_2v", semillaOrigen: "detector_consistencia" });
    expect(p?.detector).toBe(true);
    expect(p?.revisar[0]).toMatch(/patrón de la base/);
    expect(p?.revisar).toHaveLength(3);
    expect(p?.situaciones.dejar).toMatch(/no aplica a este estudio/);
    expect(p?.situaciones.corregir).toBeTruthy();
  });

  it("una regla del detector de tipo desconocido conserva solo la pauta del detector", () => {
    const p = pautasDelHallazgo({ ...sinNada, familia: "grupo_repetido", semillaOrigen: "detector_consistencia" });
    expect(p?.tipo).toBeNull();
    expect(p?.revisar).toHaveLength(1);
  });

  it("cada opción de un rango tiene su situación, por la clave de la opción", () => {
    const p = pautasDelHallazgo({ ...sinNada, vista: "rango", familia: "rango_num", semillaOrigen: null });
    const opciones = opcionesDeTratamiento({ vista: "rango", etiquetaPregunta: "Edad", prevista: null, seleccionMultiple: false, fueraDeLista: false, especial: null });
    for (const o of opciones) expect(situacionDeOpcion(p, o), o.clave).toBeTruthy();
  });

  it("en casi iguales la situación va por el criterio, no por la acción", () => {
    const p = pautasDelHallazgo({ ...sinNada, vista: "casi-iguales", semillaOrigen: null });
    expect(situacionDeOpcion(p, { clave: "mas-completa" })).toMatch(/a medias/);
    expect(situacionDeOpcion(p, { clave: "primera" })).toMatch(/copia/);
  });

  it("el subtipo de los casos es el más frecuente y no inventa uno", () => {
    expect(subtipoDeLosCasos(["rango", "especial", "rango", null])).toBe("rango");
    expect(subtipoDeLosCasos([null, undefined])).toBeNull();
  });
});

describe("redacción de las pautas", () => {
  const textos = todasLasPautas().flatMap(([, p]) => [...p.revisar, ...Object.values(p.situaciones)]);

  it("sin rótulos que empiecen con Qué, sin punto medio, raya, comillas angulares ni puntos suspensivos (por código)", () => {
    for (const t of textos) {
      expect(t, t).not.toMatch(/^¿?Qu[ée]\b/);
      expect(t, t).not.toMatch(/[\u00B7\u2014\u00AB\u00BB\u2026]/);
    }
  });

  it("cada texto es una frase corta que termina en punto", () => {
    for (const t of textos) {
      expect(t, t).toMatch(/\.$/);
      expect(t.length, t).toBeLessThanOrEqual(170);
    }
  });

  it("ningún tipo repite la misma pauta que otro: no hay listas genéricas", () => {
    const revisar = todasLasPautas().flatMap(([, p]) => p.revisar);
    const repetidas = revisar.filter((r, i) => revisar.indexOf(r) !== i);
    // Las dos que se comparten a propósito: la ficha física y el recopilador.
    expect(new Set(repetidas).size).toBeLessThanOrEqual(2);
  });
});
