// Mayúsculas del instrumento dentro de una frase (S7). Mata: una etiqueta gritada en medio de la oración y, al
// arreglarla, perder acentos o siglas.
import { describe, expect, test } from "vitest";
import { normalizarMayusculas } from "./etiquetas";

describe("normalizarMayusculas", () => {
  test("una etiqueta toda en mayúsculas pasa a tipo oración, con sus acentos", () => {
    expect(normalizarMayusculas("ENCUESTADOR/A: ¿QUIÉN ERA EL O LA ENCUESTADO/A PRINCIPAL?")).toBe("Encuestador/a: ¿quién era el o la encuestado/a principal?");
    expect(normalizarMayusculas("ENUMERATOR: ARE YOU SPEAKING TO A HOUSEHOLD MEMBER?")).toBe("Enumerator: are you speaking to a household member?");
    expect(normalizarMayusculas("USTED DA SU CONSENTIMIENTO PARA EL ESTUDIO RMS")).toBe("Usted da su consentimiento para el estudio RMS");
  });
  test("una instrucción inicial en mayúsculas se baja; el resto de la etiqueta no se toca", () => {
    expect(normalizarMayusculas("ASK TO THE RESPONDENT: Do you agree to take part?")).toBe("Ask to the respondent: Do you agree to take part?");
    expect(normalizarMayusculas("[NO PREGUNTAR] ¿Quién responde la encuesta?")).toBe("[No preguntar] ¿Quién responde la encuesta?");
  });
  test("las siglas de una etiqueta mixta se conservan", () => {
    expect(normalizarMayusculas("¿En qué ha gastado el dinero recibido del ACNUR?")).toBe("¿En qué ha gastado el dinero recibido del ACNUR?");
    expect(normalizarMayusculas("Establecimiento de ESSALUD")).toBe("Establecimiento de ESSALUD");
    expect(normalizarMayusculas("Acudí a otra instancia externa a la PUCP (Instancia NO PUCP)")).toBe("Acudí a otra instancia externa a la PUCP (Instancia NO PUCP)");
    expect(normalizarMayusculas("PUCP: ¿cómo calificas el servicio?")).toBe("PUCP: ¿cómo calificas el servicio?");
    expect(normalizarMayusculas("Opción A")).toBe("Opción A");
    expect(normalizarMayusculas("ESSALUD")).toBe("ESSALUD");
    expect(normalizarMayusculas("Otro (ESPECIFICAR)")).toBe("Otro (ESPECIFICAR)");
  });
});
