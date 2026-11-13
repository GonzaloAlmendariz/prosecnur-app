import { describe, expect, it } from "vitest";
import { conHorasEnLosCasos, esRestriccionDeFormato, pautasDelHallazgo, situacionDeOpcion, subtipoDeLosCasos, tipoDePauta, todasLasPautas } from "./pautasDelHallazgo";
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

  // Ítem 49 (QA30b): la restricción de fecha del formulario (un regex) recibía las pautas de un rango numérico.
  it("una restricción del formulario que es un patrón de texto recibe las pautas de formato", () => {
    expect(esRestriccionDeFormato("regex(., '^[0-3][0-9]\\.[01][0-9]\\.2026$')")).toBe(true);
    expect(esRestriccionDeFormato(". >= 18 and . <= 80")).toBe(false);
    expect(esRestriccionDeFormato(null)).toBe(false);
    expect(tipoDePauta({ ...sinNada, familia: "restriccion", restriccionDeFormato: true })).toBe("formato");
    expect(tipoDePauta({ ...sinNada, familia: "restriccion" })).toBe("rango");
    const p = pautasDelHallazgo({ ...sinNada, familia: "restriccion", restriccionDeFormato: true, semillaOrigen: null });
    expect(p?.tipo).toBe("formato");
    expect(p?.revisar.join(" ")).not.toMatch(/edad|ingreso|999/);
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

  // Ítem 49 (QA30b): la pauta de una fecha fuera del periodo de campo hablaba de una hora de fin.
  it("las pautas de una fecha hablan de horas solo si los casos traen horas", () => {
    const fecha = pautasDelHallazgo({ ...sinNada, familia: "rango_fecha", subtipo: "periodo", semillaOrigen: null, conHoras: false });
    expect(fecha?.revisar.join(" ")).not.toMatch(/hora/i);
    const horas = pautasDelHallazgo({ ...sinNada, familia: "comparar_fechas", subtipo: "fechas", semillaOrigen: null, conHoras: true });
    expect(horas?.revisar.join(" ")).toMatch(/hora de fin/);
    expect(horas?.revisar.length).toBe((fecha?.revisar.length ?? 0) + 1);
  });

  it("las horas se reconocen en lo que el motor dice de cada caso", () => {
    const e = (hecho: string, choque: string | null = null) => ({ hecho, choque });
    expect(conHorasEnLosCasos([e("se registró el 08.11.2026", "fuera del periodo de campo (del 12.08.2026 al 04.11.2026)")])).toBe(false);
    expect(conHorasEnLosCasos([e("registró \"08.11.2026\" (08.11.2026) en Fecha", "posterior al cierre del operativo (31.10.2026)")])).toBe(false);
    expect(conHorasEnLosCasos([e("pasaron 3 horas entre Inicio (10:00) y Fin (13:00)", "más que el máximo de 90 minutos")])).toBe(true);
    expect(conHorasEnLosCasos([e("registró 10:15 en Hora de inicio", "anterior a \"10.3\" (10:30) en Hora de inicio")])).toBe(true);
    expect(conHorasEnLosCasos([null, undefined])).toBe(false);
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
