// TXT-12: en la lista de respuestas de una pregunta abierta, las no respuestas («No», «.», «Ninguno», «Nada»…) van
// aparte y al final, como en la nube. El criterio es el del backend (`.txt_no_respuesta`), que el endpoint de
// sugerencias ya devuelve por persona (`no_respuesta`): aquí no se repite la regla, sólo se lleva a la respuesta única.
import { describe, expect, it } from "vitest";
import type { CodifSugerenciasSeccion, RespuestaUnica } from "../../api/codificacion";
import { clavesNoRespuesta, separarNoRespuestas } from "./noRespuestas";
import { normalizarTextoCodif } from "./sugerenciasModulo";

const sug = (respuestas: CodifSugerenciasSeccion["respuestas"]): CodifSugerenciasSeccion => ({
  variable: "coment", base: "ccss", requiereConfirmacion: true, modulos: [], otro: { codigo: "80", etiqueta: "Otro" },
  respuestas, resumen: { escribieron: 0, conContenido: 0, conPropuesta: 0, candidatosOtro: 0, porModulo: {} },
});
const fila = (idCaso: string, texto: string, noRespuesta: boolean) =>
  ({ idCaso, fila: Number(idCaso.slice(1)), texto, noRespuesta, candidatoOtro: false, propuestas: [] });
const unica = (texto: string, frecuencia: number, uuids: string[] = []): RespuestaUnica =>
  ({ texto, texto_normalizado: normalizarTextoCodif(texto), variantes: 1, frecuencia, uuids });

const RESPUESTAS = [
  unica("No", 8, ["u1"]),
  unica(".", 6, ["u2"]),
  unica("Más espacios de estudio", 2, ["u3"]),
  unica("Ninguno", 1, ["u4"]),
  unica("Los docentes deberían llegar a tiempo", 1, ["u5"]),
];

describe("clavesNoRespuesta", () => {
  it("toma la marca del backend por texto o por caso, sin repetir la regla", () => {
    const s = sug([
      fila("u1", "No", true),
      fila("u2", ".", true),
      fila("u3", "Más espacios de estudio", false),
      // El texto difiere de la respuesta única pero el caso es el mismo: se reconoce por el id.
      fila("u4", " ninguno ", true),
      fila("u5", "Los docentes deberían llegar a tiempo", false),
    ]);
    expect([...clavesNoRespuesta(s, RESPUESTAS)].sort()).toEqual([".", "ninguno", "no"]);
  });

  it("lo que el backend no marca no se separa (no se inventa el criterio en el front)", () => {
    expect(clavesNoRespuesta(sug([fila("u1", "No", false)]), RESPUESTAS).size).toBe(0);
  });
});

describe("separarNoRespuestas", () => {
  it("las no respuestas van aparte y al final; el resto conserva su orden", () => {
    const { conContenido, noRespuestas } = separarNoRespuestas(RESPUESTAS, new Set(["no", ".", "ninguno"]));
    expect(conContenido.map((r) => r.texto)).toEqual(["Más espacios de estudio", "Los docentes deberían llegar a tiempo"]);
    expect(noRespuestas.map((r) => r.texto)).toEqual(["No", ".", "Ninguno"]);
  });

  it("sin marcas, la lista queda igual", () => {
    const { conContenido, noRespuestas } = separarNoRespuestas(RESPUESTAS, new Set());
    expect(conContenido).toHaveLength(5);
    expect(noRespuestas).toHaveLength(0);
  });
});
